define(['jquery', 'lodash', 'util/util', 'util/render', 'data/boston_neighborhoods.js', 'google_map', 'markerclusterer'], function ($, _, util, render, neighborhoods_shape) {
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
                
                render.render($scope, "crime");
                render.render($scope, "311");
            }
        });        
    }

    return {
        initMap: initMap
    };
});