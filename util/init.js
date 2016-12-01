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
                    zoom: 11,
                    mapTypeControl: false
                });                
                var map = $scope.map;
                google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
                    $(".filter-top").css("visibility", "initial").hide().fadeIn(600);                    
                });
                map.fitBounds(results[0].geometry.bounds);
                // trigered on every change of viewport
                // todo: limit zoom/pan level/area cannot move outside bos
                // this is not currently used
                //google.maps.event.addListener(map, 'idle', () => {
                //    var bounds = map.getBounds();
                //    var ne = bounds.getNorthEast(); // LatLng of the north-east corner
                //    var sw = bounds.getSouthWest(); // LatLng of the south-west corder
                //    var nw = new google.maps.LatLng(ne.lat(), sw.lng());
                //    var se = new google.maps.LatLng(sw.lat(), ne.lng());
                //});
                google.maps.event.addListener(map, 'click', () => {
                    // enable click event on all regions
                    $scope.regionClickDisabled = false;
                    // remove neighborhood filter if any
                    if ($scope.currSelectedRegion) {
                        $scope.currSelectedRegion = null;
                        // show all regions
                        _.forOwn($scope.region_neighborhood_ht, value => {
                            _.forEach(value, region => region.setOptions({ strokeOpacity: 0.8, fillOpacity: 0.5 }));
                        });
                        render.renderAll($scope);
                    }
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
                    _.forEach(value, region => addEventListeners($scope, region));
                });

                map.addListener('zoom_changed', () => {
                    console.log("current zoom level: " + map.getZoom());
                    // todo: performance index
                    if (map.getZoom() <= 13 && map.getZoom() < $scope.prevZoomLevel) {
                        // zoomed out (far view), show selected region polygon
                        // or all region polygons if there're no selected region
                        if (!$scope.enable_hover) {
                            if (!$scope.currSelectedRegion){
                                _.forOwn($scope.region_neighborhood_ht, value => {
                                    _.forEach(value, region => region.setOptions({ strokeOpacity: 0.8, fillOpacity: 0.5 }));
                                });
                            }
                            else {
                                $scope.currSelectedRegion.setOptions({ strokeOpacity: 0.8, fillOpacity: 0.5 });
                            }
                        }
                        $scope.enable_hover = true;                        
                    } else if (map.getZoom() > 13) {
                        if ($scope.enable_hover) {
                            // hide all region polygons in street view
                            _.forOwn($scope.region_neighborhood_ht, value => {
                                _.forEach(value, region => region.setOptions({ strokeOpacity: 0.0, fillOpacity: 0.0 }));
                            });
                        }
                        $scope.enable_hover = false;
                    }
                    $scope.prevZoomLevel = map.getZoom();
                });

                initDateTimeFilter();
                render.renderAll($scope);
            }
        });
    }

    function addEventListeners($scope, polygon) {
        var map = $scope.map,
            region_neighborhood_ht = $scope.region_neighborhood_ht;
        google.maps.event.addListener(polygon, 'click', function (event) {
            if (!$scope.regionClickDisabled) {
                // make sure enable hover & remove filter region code not triggered
                $scope.prevZoomLevel = 0;
                // diable click event handler on all regions
                $scope.regionClickDisabled = true;
                // set region filter
                $scope.currSelectedRegion = this;
                _.forOwn(region_neighborhood_ht, (value, key) => {
                    if (value.indexOf(this) !== -1) {
                        // todo: update sidebar etc.
                        // key is the name of the neighborhood
                        //alert(key);
                    }
                });
                map.setCenter(this.getBounds().getCenter());
                map.setZoom(util.getZoomByBounds(map, this.getBounds()));
                // hide all other region polygons
                _.forOwn($scope.region_neighborhood_ht, value => {
                    _.forEach(value, region => { if (region !== this) region.setOptions({ strokeOpacity: 0.0, fillOpacity: 0.0 }) });
                });

                render.renderAll($scope);
            }
            else {
                // propagate event to map
                google.maps.event.trigger($scope.map, 'click', null);
            }
        });
        google.maps.event.addListener(polygon, 'mouseover', function (event) {
            // Within the event listener, "this" refers to the polygon which
            // received the event.
            this.setOptions({
                strokeColor: '#00ff00',
                fillColor: '#00ff00'
            });
        });
        google.maps.event.addListener(polygon, 'mouseout', function (event) {
            this.setOptions({
                strokeColor: '#ff0000',
                fillColor: '#ff0000'
            });
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