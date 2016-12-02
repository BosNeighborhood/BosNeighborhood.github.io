define(['jquery', 'lodash', 'd3', 'util/util', 'util/render', 'data/boston_neighborhoods.js', 'google_map', 'markerclusterer'], function ($, _, d3, util, render, neighborhoods_shape) {
    function initMap($scope) {
        var region_neighborhood_ht = $scope.region_neighborhood_ht;
        new google.maps.Geocoder().geocode({ 'address': "Boston" }, (results, status) => {
            // todo: retry if status is not OK
            if (status == google.maps.GeocoderStatus.OK) {
                var bos_lat = results[0].geometry.location.lat(),
                    bos_lng = results[0].geometry.location.lng();

                // todo: hide unneccesary things on map (highways, map/satelite etc)            
                $scope.map = new google.maps.Map(document.getElementById('map'), {
                    center: { lat: bos_lat, lng: bos_lng },
                    zoom: 10
                });
                var map = $scope.map;
                google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
                    $(".filter-top").css("visibility", "initial").hide().fadeIn(600);
                });
                map.fitBounds(results[0].geometry.bounds);
                // trigered on every change of viewport
                // todo: limit zoom/pan level/area cannot move outside bos
                // this is not currently used
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
                                strokeColor: '#ff8080',
                                strokeOpacity: 0.8,
                                strokeWeight: 2,
                                fillColor: '#ff8080',
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
                    _.forEach(value, region => util.addEventListeners($scope, region));
                });

                map.addListener('zoom_changed', () => {
                    console.log("current zoom level: " + map.getZoom());
                    // todo: performance index
                    if (map.getZoom() <= 13 && map.getZoom() < $scope.prevZoomLevel) {
                        if (!$scope.enable_hover) {
                            _.forOwn($scope.region_neighborhood_ht, value => {
                                _.forEach(value, region => region.setOptions({ strokeOpacity: 0.8, fillOpacity: 0.5 }));
                            });
                        }
                        $scope.enable_hover = true;

                        // remove filter on neighborhood, show all markers
                        // todo: add a flag, only do so when necessary
                        _($scope.markers).values().flatten().forEach(marker=>marker.setVisible(true));
                        _.forOwn($scope.markerCluster, (cluster, key) => {
                            cluster.clearMarkers();
                            cluster.addMarkers($scope.markers[key]);
                        });
                        $scope.currSelectedRegion = null;
                        $scope.$emit('renderDateTimeFilter');
                    } else if (map.getZoom() > 13) {
                        if ($scope.enable_hover) {
                            _.forOwn($scope.region_neighborhood_ht, value => {
                                _.forEach(value, region => region.setOptions({ strokeOpacity: 0.0, fillOpacity: 0.0 }));
                            });
                        }
                        $scope.enable_hover = false;
                    }
                    $scope.prevZoomLevel = map.getZoom();
                });

                initDateTimeFilter();

                render.render($scope, "crime", true);
                render.render($scope, "311", true);

                $scope.$on('renderDateTimeFilter', function () {
                    render.renderDateFilter($scope);
                    render.renderTimeFilter($scope);
                });
            }
        });
    }

    function initDateTimeFilter() {
        var svg = d3.select(".filter-bottom");
        var width = +svg.style("width").replace("px", ""),
            height = +svg.style("height").replace("px", ""),
            margin = 20;        
        svg.append("g").attr("class", "date-filter")
                       .append("g").attr("class", "axis")
                            .attr("transform", "translate(0," + (height / 2 - margin) + ")");
        svg.append("g").attr("class", "time-filter")
                       .append("g").attr("class", "axis")
                            .attr("transform", "translate(0," + (height - margin) + ")");        
    }    

    return {
        initMap: initMap
    };
});