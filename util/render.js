﻿/// <reference path="../third-party/lodash.js" />

define(['lodash', 'util/util', 'd3', 'util/Debounce', 'util/Progress', 'google_map', 'util/markerclusterer'], function (_, util, d3, Debounce, Progress) {
    // datasetType: 'crime' or '311'
    // needUpdateDateTimeFilter: boolean, update date&time filter charts if true
    function render($scope, datasetType, needUpdateDateTimeFilter) {
        return new Promise((resolve, reject) => {
            //Progress.start();
            // load new data
            var filters = datasetType === "crime" ? $scope.type_filters.selected_crime_types
                                                  : $scope.type_filters.selected_service_types,
                latLngBounds = $scope.currSelectedRegion ? $scope.currSelectedRegion.getBounds() : null;
            util.requestData(datasetType, filters, $scope.currDateTimeFilterExtent, latLngBounds, (error, response) => {
                if (error) {
                    console.log(error);
                }
                var data = JSON.parse(response.response);
                if (datasetType === '311') {
                    // create aliases to unify field names
                    _.forEach(data, record => {
                        record.long = record.longitude;
                        record.lat = record.latitude;
                        record.occurred_on_date = record.open_dt;
                    });
                }
                
                //console.log("received " + data.length + " records");
                //var num_good_record = _.reduce(data, (acc, record) => {
                //    if (!isNaN(parseFloat(record.lat)) && !isNaN(parseFloat(record.long))) {
                //        return acc + 1;
                //    }
                //    return acc;
                //}, 0);
                //console.log("good records: " + num_good_record);

                deleteMarkers($scope, datasetType);
                // create new markers            
                // todo: move to server side script to not block UI
                //var processed_records = -1;
                $scope.markers[datasetType] = _(data)
                    .filter(record => !isNaN(parseFloat(record.lat)) && !isNaN(parseFloat(record.long)))
                    .map(record => {
                        //Progress.report(++processed_records / num_good_record * 95/*leave some space for cluster rendering*/);
                        var visible = $scope.currSelectedRegion
                                        ? google.maps.geometry.poly.containsLocation(new google.maps.LatLng(+record.lat, +record.long), $scope.currSelectedRegion)
                                        : true;
                        var type = datasetType === 'crime' ? record.offense_code_group
                                                           : record.subject;
                        var lookup = {
                            crime: ['Firearm Violations', 'Larceny', 'Missing Person Reported', 'Motor Vehicle Accident Response', 'Robbery'],
                            311: ['Inspectional Servies', 'Parks & Recreation Department', 'Property Management', 'Public Works Department', 'Transportation - Traffic Division']
                        };
                        var iconUrl = `data/img/${datasetType}/${_.indexOf(lookup[datasetType], type) === -1 ? 'Others' : type}.png`;
                        return new google.maps.Marker({
                            position: { lat: +record.lat, lng: +record.long },
                            icon: iconUrl,
                            visible: visible,
                            record: record,
                            datasetType: datasetType
                        })
                    }).value();
                _.forEach($scope.markers[datasetType], marker => {
                    google.maps.event.addListener(marker, 'mouseover', function (event) {
                        // Within the event listener, "this" refers to the polygon which
                        // received the event.   
                        var formatTime = d3.timeFormat("%a %B %d, %Y %-I%p");
                        var r = this.record;
                        var content;
                        if (r.offense_code_group) {
                            content = `<b>${r.offense_code_group}</b><br />
                                        ${r.offense_description}<br />
                                        <br />
                                        ${r.street}<br />
                                        ${formatTime(new Date(r.occurred_on_date))}<br />`;
                        }
                        else {
                            content = `<b>${r.case_title}</b><br />
                                        ${r.neighborhood}<br />
                                        ${formatTime(new Date(r.occurred_on_date))}`;
                        }

                        $scope.infoWindow.setContent(content);
                        $scope.infoWindow.setPosition(event.latLng);
                        $scope.infoWindow.open($scope.map);
                    });
                });
                // update marker cluster
                if ($scope.markerCluster) {
                    $scope.markerCluster.removeMarkers(_.filter($scope.markerCluster.getMarkers(), marker => marker.datasetType === datasetType));
                    $scope.markerCluster.addMarkers(_.filter($scope.markers[datasetType], marker=>marker.getVisible()));
                }
                else
                    $scope.markerCluster = new MarkerClusterer($scope.map, $scope.markers[datasetType], { imagePath: "/data/img/crime/m", gridSize: 120 });
                initTypeFilterOptions($scope, datasetType, data);

                if (needUpdateDateTimeFilter) {
                    updateDateTimeFilter($scope);
                }

                //Progress.complete();
                resolve();

                if (datasetType === 'crime' && $scope.currSelectedRegion)
                    renderCrimeTypeChart($scope);
            });
        });
    }

    function renderDateFilter($scope) {
        // only consider markers shown on map
        var data = _($scope.markers).values().flatten().filter(val=>val.getVisible()).map(val=>val.record).value();
        // todo: remove bars
        if (data.length === 0) return;
        var svg = d3.select(".filter-bottom");
        var width = +svg.style("width").replace("px", ""),
            height = +svg.style("height").replace("px", ""),
            margin = 20;
        var formatMonth = d3.timeFormat("%b %Y");
        var dateFilter = svg.select(".date-filter");
        // month -> [{key: month_year as Date, value: count}]
        // ordered by key
        var monthIndex = d3.nest()
                .key(d=>d3.timeMonth.floor(new Date(d.occurred_on_date)))
                .sortKeys((date1, date2) => new Date(date1) - new Date(date2))
                .rollup(leaves => leaves.length)
                .entries(data);
        var max_val = _(monthIndex).map(v=>v.value).max();
        // never update x-axis scale, otherwise the existing brush extent
        // will have to move accordingly and cause confusion
        if (!$scope.dateScaleX) {
            // month
            $scope.dateScaleX = d3.scaleTime()
                .domain([new Date(_.first(monthIndex).key), d3.timeMonth.offset(new Date(_.last(monthIndex).key))])
                .range([40, width - margin]);
            d3.select(".date-filter .axis").transition().duration(300)
                // todo: fixed total # of ticks
                .call(d3.axisBottom($scope.dateScaleX).ticks(d3.timeMonth.every(3)).tickFormat(tick => formatMonth(new Date(tick))));
        }
        // percentage
        $scope.dateScaleY = d3.scaleLinear()
                .domain([0, 100])
                .rangeRound([height / 2 - (margin), 0]);
        var bars = dateFilter.selectAll(".date-filter rect").data(monthIndex);
        bars.enter()
            .append("rect").attr("class", "bar")
            .attr("x", d => $scope.dateScaleX(new Date(d.key)))
            .attr("y", d => $scope.dateScaleY(d.value / max_val * 100) - 10)
            .attr("width", d => ($scope.dateScaleX(d3.timeMonth.offset(new Date(d.key))) - $scope.dateScaleX(new Date(d.key))) * 0.95)
            .attr("height", d => height / 2 - margin - $scope.dateScaleY(d.value / max_val * 100));
        bars.exit().transition().duration(300)
            .attr("y", $scope.dateScaleY(0))
            .attr("height", d => height / 2 - margin - $scope.dateScaleY(0))
            .remove();
        // update set
        bars.transition().duration(300)
            .attr("x", d => $scope.dateScaleX(new Date(d.key)))
            .attr("y", d => $scope.dateScaleY(d.value / max_val * 100) - 10)
            .attr("width", d => ($scope.dateScaleX(d3.timeMonth.offset(new Date(d.key))) - $scope.dateScaleX(new Date(d.key))) * 0.95)
            .attr("height", d => height / 2 - margin - $scope.dateScaleY(d.value / max_val * 100));
    }

    function renderTimeFilter($scope) {
        // only consider markers shown on map
        var data = _($scope.markers).values().flatten().filter(val=>val.getVisible()).map(val=>val.record).value();
        if (data.length === 0) return;
        var svg = d3.select(".filter-bottom");
        var width = +svg.style("width").replace("px", ""),
            height = +svg.style("height").replace("px", ""),
            margin = 20;
        var formatMonth = d3.timeFormat("%b %Y");
        var timeFilter = svg.select(".time-filter");
        var timeIndex = d3.nest()
                    .key(d=>new Date(d.occurred_on_date).getHours())
                    .sortKeys((t1, t2) => d3.ascending(parseInt(t1), parseInt(t2)))
                    .rollup(leaves => leaves.length)
                    .entries(data);
        max_val = _(timeIndex).map(v=>v.value).max();
        if (!$scope.timeScaleX) {
            // time of day
            $scope.timeScaleX = d3.scaleLinear()
                .domain([0, 24])
                .rangeRound([40, width - margin]);
            d3.select(".time-filter .axis").transition().duration(300)
                .call(d3.axisBottom($scope.timeScaleX));
        }
        // percentage
        $scope.timeScaleY = d3.scaleLinear()
                .domain([0, 100])
                .rangeRound([height - margin, height - (height / 2 - margin)]);
        var bars = timeFilter.selectAll(".time-filter rect").data(timeIndex);
        bars.enter()
            .append("rect").attr("class", "bar")
            .attr("x", d => $scope.timeScaleX(+d.key))
            .attr("y", d => $scope.timeScaleY(d.value / max_val * 100) - 15)
            .attr("width", d => ($scope.timeScaleX(+d.key + 1) - $scope.timeScaleX(+d.key)) * 0.95)
            .attr("height", d => height - margin - $scope.timeScaleY(d.value / max_val * 100));
        bars.exit().transition().duration(300)
            .attr("y", $scope.timeScaleY(0))
            .attr("height", d => height - margin - $scope.timeScaleY(0))
            .remove();
        // update set
        bars.transition().duration(300)
            .attr("x", d => $scope.timeScaleX(+d.key))
            .attr("y", d => $scope.timeScaleY(d.value / max_val * 100) - 15)
            .attr("width", d => ($scope.timeScaleX(+d.key + 1) - $scope.timeScaleX(+d.key)) * 0.95)
            .attr("height", d => height - margin - $scope.timeScaleY(d.value / max_val * 100));
    }

    function deleteMarkers($scope, datasetType) {
        _.forEach($scope.markers[datasetType], marker => marker.setMap(null));
        $scope.markers[datasetType] = [];
    }

    // load crime/service type filter options if needed
    function initTypeFilterOptions($scope, datasetType, data) {
        var types, field;
        if (datasetType === 'crime') {
            types = $scope.crime_types;
            field = 'offense_code_group';
        }
        else {
            // 311
            types = $scope.service_types;
            field = 'subject';
        }
        if (types.length === 1) {
            _(data).map(record => record[field]).uniq()
                    .forEach(type => types.push(type));
            var filterId = datasetType === 'crime' ? "#crime-type-filter"
                                                   : "#service-type-filter";
            $(filterId).trigger("chosen:updated");
        }
    }

    function initBrush($scope) {
        var svg = d3.select(".filter-bottom svg");
        var width = +svg.style("width").replace("px", ""),
            height = +svg.style("height").replace("px", ""),
            margin = 20;
        var brushDate = d3.brushX()
                          .extent([[40, -10], [width - margin, height / 2 - margin - 10]])
                          .on("brush", onBrush)
                          .on("end", onBrushEnd);
        var eventSelection = {};
        svg.append("g").attr("class", "brush-date")
          		.call(brushDate)
          		.call(brushDate.move, [$scope.dateScaleX(new Date(2015, 9, 1)), $scope.dateScaleX(new Date(2016, 5, 30))]);

        var brushTime = d3.brushX()
                          .extent([[40, height - (height / 2 - margin) - 15], [width - margin, height - margin - 15]])
                          .on("brush", onBrush)
                          .on("end", onBrushEnd);
        svg.append("g").attr("class", "brush-time")
           	       .call(brushTime);

        function onBrush() {
            var filterType = d3.select(this).attr("class").split('-').pop();
            eventSelection[filterType] = d3.event.selection.slice();
            Debounce.observed(filterType, $scope);
        }

        function onBrushEnd() {
            // if brush cleared
            if (!d3.event.selection) {
                var filterType = d3.select(this).attr("class").split('-').pop();
                eventSelection[filterType] = [0, width - margin];
                Debounce.observed(filterType, $scope);
            }
        }

        $scope.$on('debounceAccept', (event, filterType) => doBrush(filterType));

        function doBrush(filterType) {
            var scale = filterType === 'date' ? $scope.dateScaleX : $scope.timeScaleX,
                selection = eventSelection[filterType];
            if (!selection) {
                // brush cleared, select all
                selection = [0, width - margin];
            }
            var extent = selection.map(scale.invert);
            if (filterType === 'time') extent = extent.map(Math.floor);
            else extent = extent.map(d3.timeMonth.floor)

            if ($scope.currDateTimeFilterExtent[filterType] && +$scope.currDateTimeFilterExtent[filterType][0] == +extent[0] && +$scope.currDateTimeFilterExtent[filterType][1] == +extent[1])
                return;
            $scope.currDateTimeFilterExtent[filterType] = extent;
            // todo: API call vs local filter on different data sizes
            // API call bug: can only see filtered data, so lose "grey bars"
            Promise.all([
                render($scope, 'crime'),
                render($scope, '311')
            ]).then(() => {
                // only update filter chart other than this one
                if (filterType === 'date') {
                    renderTimeFilter($scope);
                    updateDateFilterStyle(extent);
                    if (!$scope.currDateTimeFilterExtent['time'])
                        $scope.currDateTimeFilterExtent['time'] = [0, width - margin].map($scope.timeScaleX.invert).map(Math.floor);
                    updateTimeFilterStyle($scope.currDateTimeFilterExtent['time']);
                }
                else {
                    renderDateFilter($scope);
                    if (!$scope.currDateTimeFilterExtent['date'])
                        $scope.currDateTimeFilterExtent['date'] = [0, width - margin].map($scope.dateScaleX.invert).map(d3.timeMonth.floor);
                    updateDateFilterStyle($scope.currDateTimeFilterExtent['date']);
                    updateTimeFilterStyle(extent);
                }
            });
        }
    }

    function updateDateFilterStyle(extent) {
        d3.selectAll(".date-filter .bar")
          .classed("bar-background", d=> new Date(d.key) > extent[1] || new Date(d.key) < extent[0]);
    }

    function updateTimeFilterStyle(extent) {
        d3.selectAll(".time-filter .bar")
          .classed("bar-background", d=> +d.key > extent[1] || +d.key < extent[0]);
    }

    function updateDateTimeFilter($scope) {
        renderDateFilter($scope);
        renderTimeFilter($scope);
        if ($scope.currDateTimeFilterExtent.date)
            updateDateFilterStyle($scope.currDateTimeFilterExtent.date);
        if ($scope.currDateTimeFilterExtent.time)
            updateTimeFilterStyle($scope.currDateTimeFilterExtent.time);
    }

    // request and render crime & 311 dataset based on type filters and
    // region filter, update date & time filter charts
    function renderAll($scope) {
        Promise.all([
           render($scope, 'crime'),
           render($scope, '311')
        ]).then(() => {
            updateDateTimeFilter($scope);
        });
    }

    // todo: the result is an approximation, not exact numbers
    // for current region
    //      to improve performance it relies on the API to aggregate records
    //      within current regions bounding box, which will almost always be 
    //      overstatement, level of overstatement depends on region's shape 
    //      axis-aligned rectangluar region should return exact numbers
    // for average data
    //      due to lack of population/area data, the average is calculated as
    //      total number of records per type / total numbers of regions on map
    //      ideally all number should be normalized according to population
    function renderCrimeTypeChart($scope) {
        return new Promise((resolve, reject) => {
            d3.queue()
              // request crime data for selected region in current date/time range
              .defer(util.requestAggCrimeData, $scope.currDateTimeFilterExtent, $scope.currSelectedRegion.getBounds())
              // request crime data for all regions in current date/time range
              .defer(util.requestAggCrimeData, $scope.currDateTimeFilterExtent, null)
              .await((error, regionResponse, allResponse) => {
                  if (error) {
                      console.log(error);
                  }
                  var regionData = JSON.parse(regionResponse.response),
                      allData = JSON.parse(allResponse.response);
                  regionTypeIndex = _(regionData).take(5).map(d=> {
                      return {
                          key: d.offense_code_group,
                          value: +d.count_offense_code_group
                      };
                  }).value();
                  var num_regions = _($scope.region_neighborhood_ht).values().flatten().value().length,
                      max_value = -1;
                  regionTypeIndex = _.map(regionTypeIndex, type => {
                      var allCount = +allData.find(d=>d.offense_code_group === type.key).count_offense_code_group,
                          avg = Math.round(allCount / num_regions);
                      if (type.value > max_value) max_value = type.value;
                      if (avg > max_value) max_value = avg;
                      return {
                          key: type.key,
                          value: type.value,
                          avg: avg
                      };
                  });
                  // data collected, now render chart
                  var svg = d3.select("#neighborhoods svg");
                  var width = +svg.style("width").replace("px", ""),
                      height = +svg.style("height").replace("px", ""),
                      margin = 20,
		              padding = 30;
                  var x0 = d3.scaleBand().domain(_.map(regionTypeIndex, e=>e.key)).rangeRound([margin, width - margin]).padding(0.1),
                      x1 = d3.scaleBand().domain(['value', 'avg']).rangeRound([20, x0.bandwidth()]),
                      y = d3.scaleLinear().domain([0, max_value]).range([height - margin, margin]);
                  d3.select("#neighborhoods svg .x-axis").transition().duration(300)
                          .call(d3.axisBottom(x0).tickFormat(type => type.trunc(10)))
						  .selectAll("text")
							.style("text-anchor", "middle")
							.attr("dx", "-.8em")
							.attr("dy", ".15em")
							.attr("transform", "rotate(0)");

                  d3.select("#neighborhoods svg .y-axis").transition().duration(300)
						   .call(d3.axisLeft(y).ticks(5));


                  var types = svg.selectAll(".type").data(regionTypeIndex);
                  types.exit().selectAll("rect").transition().duration(300)
                              .attr("y", y(0))
                              .attr("height", d => height - margin - y(0))
                              .remove();
                  var typesEnter = types.enter().append("g")
                                 .attr("class", "type")
                                 .attr("transform", d => "translate(" + x0(d.key) + ",0)");
                  typesEnter.selectAll("rect")
                       .data(d =>[{ name: 'value', value: d.value }, { name: 'avg', value: d.avg }])
                       .enter()
                       .append("rect")
                          .attr("width", x1.bandwidth())
                          .attr("x", d => x1(d.name) + 5)
                          .attr("y", d => y(d.value))
                          .attr("height", d => height - margin - y(d.value))
                          .style("fill", d => d.name === 'value' ? '#FAA41A' : '#ccc');
                  //update set
                  types.selectAll("rect").transition().duration(300)
                          .attr("y", d => y(d.value))
                          .attr("height", d => height - margin - y(d.value))
                  resolve();
              });
        });
    }

    return {
        render: render,
        initBrush: initBrush,
        renderAll: renderAll
    };
});
