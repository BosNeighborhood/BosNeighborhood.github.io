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
                _.forEach(data, record => {
                    record.long = record.longitude;
                    record.lat = record.latitude;
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
            // load filter options if needed
            // todo: move into one util function
            if (datasetType === 'crime' && $scope.crime_types.length === 1) {
                _(data).map(record => record.offense_code_group).uniq()
                        .forEach(type => $scope.crime_types.push(type));
                var filterId = "#crime-type-filter";
                $(filterId).trigger("chosen:updated");
            }
            if (datasetType === '311' && $scope.service_types.length === 1) {
                _(data).map(record => record.subject).uniq()
                        .forEach(type => $scope.service_types.push(type));
                var filterId = "#service-type-filter";
                $(filterId).trigger("chosen:updated");
            }
        });
    }

    function deleteMarkers($scope) {
        _.forOwn($scope.markers, markers => {
            _.forEach(markers, marker => marker.setMap(null));
        });        
        $scope.markers = {};
    }

    return {
        render: render
    };
});