/// <reference path="../third-party/lodash.js" />

define(['lodash', 'util/util', 'd3', 'google_map'], function (_, util, d3) {
    // datasetType: 'crime' or '311'
    function render($scope, datasetType) {
        // remove old data
        // todo: support type
        deleteMarkers($scope);
        _.forOwn($scope.markerCluster, cluster => cluster.clearMarkers());

        // load new data
        var filters = datasetType === "crime" ? $scope.type_filters.selected_crime_types
                                              : $scope.type_filters.selected_service_types;
        util.requestData(datasetType, filters, (error, response) => {
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

            // create marker cluster
            $scope.markers.datasetType = _(data)
                .filter(record => !isNaN(parseFloat(record.lat)) && !isNaN(parseFloat(record.long)))
                .map(record => new google.maps.Marker({
                    position: { lat: +record.lat, lng: +record.long },
                    record: record
                })).value();
            _.forEach($scope.markers.datasetType, marker => {
                google.maps.event.addListener(marker, 'click', function (event) {
                    // Within the event listener, "this" refers to the polygon which
                    // received the event.   
                    var formatTime = d3.timeFormat("%a %B %d, %Y %-I%p");
                    var r = this.record;
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
            $scope.markerCluster.datasetType = new MarkerClusterer($scope.map, $scope.markers.datasetType, { imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m' });
            initTypeFilterOptions($scope, datasetType, data);
            renderDateTimeFilter($scope);
        });
    }

    function renderDateTimeFilter($scope) {
        if (d3.select(".date-filter").node()){return;}
        //todo: move to init code
        var data = _($scope.markers).values().flatten().map(val=>val.record).value();
        var svg = d3.select(".filter-bottom");
        var width = +svg.style("width").replace("px", ""),
            height = +svg.style("height").replace("px", ""),
            margin = 20;
        var formatMonth = d3.timeFormat("%b %Y");        
        var dateFilter = svg.append("g").attr("class", "date-filter"),
            timeFilter = svg.append("g").attr("class", "time-filter");
        // month -> [{key: month_year as Date, value: count}]
        // ordered by key
        var monthIndex = d3.nest()
                .key(d=>d3.timeMonth.floor(new Date(d.occurred_on_date)))
                .sortKeys((date1, date2) => new Date(date1) - new Date(date2))
                .rollup(leaves => leaves.length)
                .entries(data);
        var max_val = _(monthIndex).map(v=>v.value).max();
        // month
        var dateScaleX = d3.scaleTime()
                .domain([new Date(_.first(monthIndex).key), d3.timeMonth.offset(new Date(_.last(monthIndex).key))])
                .range([margin, width - margin]);
        // percentage
        var dateScaleY = d3.scaleLinear()
                .domain([0, 100])
                .rangeRound([height / 2 - margin, 0]);
        dateFilter.append("g").attr("class", "axis")
                .attr("transform", "translate(0," + (height / 2 - margin) + ")")
                // todo: fixed total # of ticks
                .call(d3.axisBottom(dateScaleX).ticks(d3.timeMonth.every(3)).tickFormat(tick => formatMonth(new Date(tick))));
        dateFilter.selectAll(".date-filter rect").data(monthIndex).enter()
            .append("rect").attr("class", "bar")
            .attr("x", d => dateScaleX(new Date(d.key)))
            .attr("y", d => dateScaleY(d.value / max_val * 100))
            .attr("width", d => (dateScaleX(d3.timeMonth.offset(new Date(d.key))) - dateScaleX(new Date(d.key))) * 0.95)
            .attr("height", d => height / 2 - margin - dateScaleY(d.value / max_val * 100));
        
        var timeIndex = d3.nest()
                    .key(d=>new Date(d.occurred_on_date).getHours())
                    .sortKeys(d3.ascending)
                    .rollup(leaves => leaves.length)
                    .entries(data);
        max_val = _(timeIndex).map(v=>v.value).max();
        // time of day
        var timeScaleX = d3.scaleLinear()
                .domain([0, 24])
                .rangeRound([margin, width - margin]);
        // percentage
        var timeScaleY = d3.scaleLinear()
                .domain([0, 100])
                .rangeRound([height - margin, height - (height / 2 - margin)]);
        timeFilter.append("g").attr("class", "axis")
                .attr("transform", "translate(0," + (height - margin) + ")")
                .call(d3.axisBottom(timeScaleX));
        timeFilter.selectAll(".time-filter rect").data(timeIndex).enter()
            .append("rect").attr("class", "bar")
            .attr("x", d => timeScaleX(+d.key))
            .attr("y", d => timeScaleY(d.value / max_val * 100))
            .attr("width", d => (timeScaleX(+d.key + 1) - timeScaleX(+d.key)) * 0.95)
            .attr("height", d => height - margin - timeScaleY(d.value / max_val * 100))
    }

    function deleteMarkers($scope) {
        _.forOwn($scope.markers, markers => {
            _.forEach(markers, marker => marker.setMap(null));
        });
        $scope.markers = {};
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

    return {
        render: render
    };
});