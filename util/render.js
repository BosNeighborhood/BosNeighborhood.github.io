/// <reference path="../third-party/lodash.js" />

define(['lodash', 'util/util', 'd3', 'util/Debounce', 'google_map'], function (_, util, d3, Debounce) {
    // datasetType: 'crime' or '311'
    function render($scope, datasetType, updateDateTimeFilter) {
        return new Promise((resolve, reject) => {
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

                // todo: comment out in production
                console.log("received " + data.length + " records");
                var num_good_record = _.reduce(data, (acc, record) => {
                    if (!isNaN(parseFloat(record.lat)) && !isNaN(parseFloat(record.long))) {
                        return acc + 1;
                    }
                    return acc;
                }, 0);
                console.log("good records: " + num_good_record);

                deleteMarkers($scope, datasetType);                
                // create new markers            
                $scope.markers[datasetType] = _(data)
                    .filter(record => !isNaN(parseFloat(record.lat)) && !isNaN(parseFloat(record.long)))
                    .map(record => {
                        var visible = $scope.currSelectedRegion 
                                        ? google.maps.geometry.poly.containsLocation(new google.maps.LatLng(+record.lat, +record.long), $scope.currSelectedRegion)
                                        : true;
                        return new google.maps.Marker({
                            position: { lat: +record.lat, lng: +record.long },
                            visible: visible,
                            record: record
                        })
                    }).value();
                _.forEach($scope.markers[datasetType], marker => {
                    google.maps.event.addListener(marker, 'click', function (event) {
                        // Within the event listener, "this" refers to the polygon which
                        // received the event.   
                        var formatTime = d3.timeFormat("%a %B %d, %Y %-I%p");
                        var r = this.record;
                        // todo: content for 311 data
                        var content = `<b>${r.offense_code_group}</b><br />
                        ${r.offense_description}<br />
                        <br />
                        ${r.street}<br />
                        ${formatTime(new Date(r.occurred_on_date))}<br />`;
                        $scope.infoWindow.setContent(content);
                        $scope.infoWindow.setPosition(event.latLng);
                        $scope.infoWindow.open($scope.map);
                    });
                });
                // update marker cluster
                if ($scope.markerCluster[datasetType]){
                    $scope.markerCluster[datasetType].clearMarkers();
                    $scope.markerCluster[datasetType].addMarkers(_.filter($scope.markers[datasetType], marker=>marker.getVisible()));
                }
                else
                    $scope.markerCluster[datasetType] = new MarkerClusterer($scope.map, $scope.markers[datasetType], { imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m' });
                initTypeFilterOptions($scope, datasetType, data);

                if (updateDateTimeFilter) {
                    renderDateFilter($scope);
                    renderTimeFilter($scope);
                    if ($scope.currDateTimeFilterExtent.date)
                        updateDateFilterStyle($scope.currDateTimeFilterExtent.date);
                    if ($scope.currDateTimeFilterExtent.time)
                        updateTimeFilterStyle($scope.currDateTimeFilterExtent.time);
                }

                resolve();
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
                .range([0, width - margin]);
            d3.select(".date-filter .axis").transition().duration(300)
                // todo: fixed total # of ticks
                .call(d3.axisBottom($scope.dateScaleX).ticks(d3.timeMonth.every(3)).tickFormat(tick => formatMonth(new Date(tick))));
        }
        // percentage
        $scope.dateScaleY = d3.scaleLinear()
                .domain([0, 100])
                .rangeRound([height / 2 - margin, 0]);
        var bars = dateFilter.selectAll(".date-filter rect").data(monthIndex);
        bars.enter()
            .append("rect").attr("class", "bar")
            .attr("x", d => $scope.dateScaleX(new Date(d.key)))
            .attr("y", d => $scope.dateScaleY(d.value / max_val * 100))
            .attr("width", d => ($scope.dateScaleX(d3.timeMonth.offset(new Date(d.key))) - $scope.dateScaleX(new Date(d.key))) * 0.95)
            .attr("height", d => height / 2 - margin - $scope.dateScaleY(d.value / max_val * 100));
        bars.exit().transition().duration(300)
            .attr("y", $scope.dateScaleY(0))
            .attr("height", d => height / 2 - margin - $scope.dateScaleY(0))
            .remove();
        // update set
        bars.transition().duration(300)
            .attr("x", d => $scope.dateScaleX(new Date(d.key)))
            .attr("y", d => $scope.dateScaleY(d.value / max_val * 100))
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
                .rangeRound([0, width - margin]);
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
            .attr("y", d => $scope.timeScaleY(d.value / max_val * 100))
            .attr("width", d => ($scope.timeScaleX(+d.key + 1) - $scope.timeScaleX(+d.key)) * 0.95)
            .attr("height", d => height - margin - $scope.timeScaleY(d.value / max_val * 100));
        bars.exit().transition().duration(300)
            .attr("y", $scope.timeScaleY(0))
            .attr("height", d => height - margin - $scope.timeScaleY(0))
            .remove();
        // update set
        bars.transition().duration(300)
            .attr("x", d => $scope.timeScaleX(+d.key))
            .attr("y", d => $scope.timeScaleY(d.value / max_val * 100))
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
        var svg = d3.select(".filter-bottom");
        var width = +svg.style("width").replace("px", ""),
            height = +svg.style("height").replace("px", ""),
            margin = 20;
        var brushDate = d3.brushX()
                          .extent([[0, 0], [width, height / 2 - margin]])
                          .on("brush", onBrush)
                          .on("end", onBrushEnd);
        var eventSelection = {};
        svg.append("g").attr("class", "brush-date")
           .call(brushDate)
           .call(brushDate.move, [$scope.dateScaleX(new Date(2015, 9, 1)), $scope.dateScaleX(new Date(2016, 5, 30))]);

        var brushTime = d3.brushX()
                          .extent([[0, height - (height / 2 - margin)], [width, height - margin]])
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
                eventSelection[filterType] = d3.event.selection.slice();
                Debounce.observed(filterType, $scope);
            }
        }

        $scope.$on('debounceAccept', (event, filterType) => doBrush(filterType));

        function doBrush(filterType) {
            var scale = filterType === 'date' ? $scope.dateScaleX : $scope.timeScaleX,
                selection = eventSelection[filterType];
            if (!selection) {
                // brush cleared, select all
                selection = [0, width];
            }
            var extent = selection.map(scale.invert);
            if (filterType === 'time') extent = extent.map(Math.round);
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
                // only update filters other than this one
                if (filterType === 'time') {
                    updateTimeFilterStyle(extent);
                    renderDateFilter($scope);
                } else {
                    updateDateFilterStyle(extent);
                    renderTimeFilter($scope);
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

    return {
        render: render,
        initBrush: initBrush,
        renderDateFilter: renderDateFilter,
        renderTimeFilter: renderTimeFilter
    };
});