/// <reference path="../third-party/lodash.js" />

define(['lodash', 'util/util', 'google_map'], function (_, util) {
    // datasetType: 'crime' or '311'
    function render($scope, datasetType) {
        // remove old data
        // todo: support type
        deleteMarkers($scope);
        if ($scope.markerCluster) $scope.markerCluster.clearMarkers();

        // load new data
        var filters = datasetType === "crime" ? $scope.type_filters.selected_crime_types
                                              : $scope.type_filters.selected_service_types;
        util.requestData(datasetType, filters, (error, response) => {
            if (error) {
                console.log(error);
            }
            var data = JSON.parse(response.response);

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
            // todo: only create marker if record is "good"
            $scope.markers = _(data).map(record => new google.maps.Marker({
                position: { lat: +record.lat, lng: +record.long },
                // todo: actual label
                label: "TBD"
            })).value();            
            $scope.markerCluster = new MarkerClusterer(map, $scope.markers, { imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m' });
            // load filter options if needed
            if ($scope.crime_types.length === 1) {
                _(data).map(record => record.offense_code_group).uniq()
                        .forEach(type => $scope.crime_types.push(type));
                var filterId = datasetType === "crime" ? "#crime-type-filter"
                                                       : "#service-type-filter";
                $(filterId).trigger("chosen:updated");
            }
        });
    }

    function deleteMarkers($scope) {
        _.forEach($scope.markers, marker => marker.setMap(null));
        $scope.markers = [];        
    }

    return {
        render: render
    };
});