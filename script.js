/// <reference path="util/util.js" />
/// <reference path="third-party/markerclusterer.js" />
/// <reference path="third-party/google-map.js" />
/// <reference path="third-party/d3.js" />
/// <reference path="third-party/lodash.js" />
/// <reference path="third-party/require.js" />

require.config({
    baseUrl: 'third-party',
    paths: {
        shapefile: '../shapefile',
        util: '../util',
        google_map: 'https://maps.googleapis.com/maps/api/js?key=AIzaSyAS0nUuUJ0wPAHEXOtKst5sJoDl-Vb5CJQ',
        angular: 'https://ajax.googleapis.com/ajax/libs/angularjs/1.5.8/angular.min',
        jquery: 'jquery-3.1.1.min'
    },
    shim: {
        angular: {
            exports: 'angular'
        },        
        'chosen/angular-chosen.min': {
            deps: ['jquery', 'angular', 'chosen/chosen.jquery']
        }
    }
});

require(['jquery', 'lodash', 'd3', 'angular', 'shapefile/boston_neighborhoods.js', 'util/util', 'google_map', 'markerclusterer', 'chosen/angular-chosen.min'],
function ($, _, d3, angular, neighborhoods_shape, util) {
    var app = angular.module("BosNeighborhood", ['localytics.directives']);
    app.controller("BosNeighborhoodController", function ($scope, $timeout) {        
        $scope.crime_types = ['All'];
        $scope.service_types = ['All'];
        $scope.type_filters = { selected_crime_types: ['All'], selected_service_types: ['All'] };
        $("#crime-type-filter").chosen({ placeholder_text_multiple: 'Select crime types' })
            .change(() => {
                // make sure callback runs in next digest cycle
                // http://stackoverflow.com/questions/29506103/directive-updates-to-parent-scope-one-step-delayed
                $timeout(() => {
                    console.log($scope.type_filters.selected_crime_types);
                });
            });
        $("#service-type-filter").chosen({ placeholder_text_multiple: 'Select 311 types' })
            .change(() => {
                $timeout(() => {
                    console.log($scope.type_filters.selected_service_types);
                });
            });

        var map;

        // todo: separate into init and render map
        function initMap() {
            new google.maps.Geocoder().geocode({ 'address': "Boston" }, (results, status) => {
                var region_neighborhood_ht = {};

                // todo: retry if status is not OK
                if (status == google.maps.GeocoderStatus.OK) {
                    var bos_lat = results[0].geometry.location.lat(),
                        bos_lng = results[0].geometry.location.lng();

                    // todo: hide unneccesary things on map (highways, map/satelite etc)            
                    map = new google.maps.Map(document.getElementById('map'), {
                        center: { lat: bos_lat, lng: bos_lng },
                        zoom: 10
                    });
                    map.fitBounds(results[0].geometry.bounds);
                    // triger event on every change of viewport
                    // todo: efficiency
                    // todo: limit zoom/pan level/area cannot move outside bos
                    google.maps.event.addListener(map, 'idle', () => {
                        var bounds = map.getBounds();
                        var ne = bounds.getNorthEast(); // LatLng of the north-east corner
                        var sw = bounds.getSouthWest(); // LatLng of the south-west corder
                        var nw = new google.maps.LatLng(ne.lat(), sw.lng());
                        var se = new google.maps.LatLng(sw.lat(), ne.lng());
                    });
                    // load neighborhood borders as polygons
                    _.forEach(neighborhoods_shape.features, neighborhood => {
                        if (neighborhood.geometry.type === "Polygon") {
                            neighborhood.geometry.coordinates = [neighborhood.geometry.coordinates];
                        }
                        _.forEach(neighborhood.geometry.coordinates, polygons => {
                            _.forEach(polygons, polygon => {
                                var region = new google.maps.Polygon({
                                    map: map,
                                    paths: _.map(polygon, point => new google.maps.LatLng(+point[1], +point[0])),
                                    // todo: style
                                    strokeColor: '#ff0000',
                                    strokeOpacity: 0.8,
                                    strokeWeight: 2,
                                    fillColor: '#ff0000',
                                    fillOpacity: 0.5
                                });
                                if (!_.has(region_neighborhood_ht, neighborhood.properties.Name)) {
                                    region_neighborhood_ht[neighborhood.properties.Name] = [];
                                }
                                region_neighborhood_ht[neighborhood.properties.Name].push(region);
                            });
                        });
                    });

                    _.forOwn(region_neighborhood_ht, (value, key) => {
                        _.forEach(value, region => util.addEventListeners(region, map, region_neighborhood_ht));
                    });
                    // load crime data
                    util.requestData((error, response) => {
                        if (error) {
                            console.log(error);
                        }
                        var data = JSON.parse(response.response);
                        // create marker cluster
                        var markers = _(data).map(record => new google.maps.Marker({
                            position: { lat: +record.lat, lng: +record.long },
                            // todo: actual label
                            label: "TBD"
                        })).value();
                        var markerCluster = new MarkerClusterer(map, markers, { imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m' });
                        // load filter options if needed
                        if ($scope.crime_types.length === 1) {
                            _(data).map(record => record.offense_code_group).uniq()
                                    .forEach(type => $scope.crime_types.push(type));
                            $("#crime-type-filter").trigger("chosen:updated");                            
                        }                        
                    });
                }
            });
        }
        initMap();
    });
    angular.bootstrap(document, ['BosNeighborhood']);
});