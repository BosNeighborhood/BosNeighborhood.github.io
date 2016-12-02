define(['lodash', 'd3', 'util/UrlBuilder', 'google_map', 'jquery','angular'], function (_, d3, UrlBuilder,$,angular) {
    if (!google.maps.Polygon.prototype.getBounds) {
        google.maps.Polygon.prototype.getBounds = function () {
            var bounds = new google.maps.LatLngBounds()
            this.getPath().forEach(function (element, index) { bounds.extend(element) })
            return bounds
        }
    }
    /**
    * Returns the zoom level at which the given rectangular region fits in the map view. 
    * The zoom level is computed for the currently selected map type. 
    * @param {google.maps.Map} map
    * @param {google.maps.LatLngBounds} bounds 
    * @return {Number} zoom level
    **/
    // http://stackoverflow.com/questions/9837017/equivalent-of-getboundszoomlevel-in-gmaps-api-3
    function getZoomByBounds(map, bounds) {
        var MAX_ZOOM = map.mapTypes.get(map.getMapTypeId()).maxZoom || 21;
        var MIN_ZOOM = map.mapTypes.get(map.getMapTypeId()).minZoom || 0;

        var ne = map.getProjection().fromLatLngToPoint(bounds.getNorthEast());
        var sw = map.getProjection().fromLatLngToPoint(bounds.getSouthWest());

        var worldCoordWidth = Math.abs(ne.x - sw.x);
        var worldCoordHeight = Math.abs(ne.y - sw.y);

        //Fit padding in pixels 
        var FIT_PAD = 40;

        for (var zoom = MAX_ZOOM; zoom >= MIN_ZOOM; --zoom) {
            if (worldCoordWidth * (1 << zoom) + 2 * FIT_PAD < $(map.getDiv()).width() &&
                worldCoordHeight * (1 << zoom) + 2 * FIT_PAD < $(map.getDiv()).height())
                return zoom;
        }
        return 0;
    }

    function requestData(datasetType, filters, dateTimeFilters, callback) {
        if (filters.length === 0) {
            // no filter selected, return nothing
            callback(null, { response: JSON.stringify([]) });
            return;
        }
        // todo: allow unlimited # of records?
        var urlBuilder = new UrlBuilder(datasetType).limit(500);
        if (datasetType === '311') {
            // remove data before Aug 2015 since no crime data for that time period is available
            urlBuilder.addCmpFilter("open_dt", ">", new Date(2015, 7, 1));
        }
        // 'All' will always come first in the list if selected
        // no need to add filters if 'All' is in list
        if (filters[0] !== 'All') {
            var column = datasetType === 'crime' ? 'offense_code_group' : 'subject';
            urlBuilder.addInFilter(column, filters);
        }
        _.forOwn(dateTimeFilters, (extent, type) => {
            // todo: filter 311 time manually
            var lookup = {
                crime: {date: 'occurred_on_date', time: 'hour'},
                311: { date: 'open_dt', time: null }
            };
            var column = lookup[datasetType][type];
            if (column !== null) {
                if (type === 'date') {
                    urlBuilder.addCmpFilter(column, '>=', extent[0]);
                    urlBuilder.addCmpFilter(column, '<=', extent[1]);
                } else if (type === 'time') {
                    // hour in dataset is text not number
                    // might cause problem e.g. '6' <= hour <= '10'
                    // will always be false. a workaround is to transform
                    // into 'in' operation
                    urlBuilder.addInFilter(column, _.range(extent[0], extent[1] + 1));
                }
            }
        });
        d3.request(urlBuilder.url)
            .header("X-App-Token", "fa90xHwTH31A8h1WQfskk38cb")
            .get(callback);
    }
	function findNeighborhood (name){
		return key;
		
	}
    function addEventListeners($scope, polygon) {
        var map = $scope.map, 
            region_neighborhood_ht = $scope.region_neighborhood_ht,
			neighborhoodInfo = $scope.neighborhoodsInfo;
		var neighborhood = null;	
        google.maps.event.addListener(polygon, 'click', function (event) {
            // make sure enable hover & remove filter region code not triggered
            $scope.prevZoomLevel = 0;
            $scope.currSelectedRegion = this;
            _.forOwn(region_neighborhood_ht, (value, key) => {
                if (value.indexOf(this) !== -1) {
					//var name = $.grep(neighborhoodInfo[0].name, function(e){ return e.name === key; });
					 neighborhood = neighborhoodInfo.find(function (d) {
						return d.name === key;
					});
					console.log("NNNNNNNNNNNNNNNeighborhood "+ neighborhood);
					$scope.selectedNeighborhood = neighborhood;
					$scope.$apply(); 
					window.alert("This neighborhood info is " + $scope.selectedNeighborhood.name);

					document.getElementById("neighborhoods").className = "tab-pane fade in active";
					document.getElementById("home").className = "tab-pane fade";
					

                    // todo: update sidebar etc.
                    // key is the name of the neighborhood
                    //alert(key);
                }
            });

            map.setCenter(this.getBounds().getCenter());
            map.setZoom(getZoomByBounds(map, this.getBounds()));
            // only show records within current neighborhood            
            // todo: performance
            _.forOwn($scope.markerCluster, (cluster, key) => {
                cluster.clearMarkers();
                _.forEach($scope.markers[key], marker=> {
                    if (!google.maps.geometry.poly.containsLocation(marker.getPosition(), this)) {
                        marker.setVisible(false);
                    } else {
                        marker.setVisible(true);
                    }
                });
                cluster.addMarkers(_.filter($scope.markers[key], marker=>marker.getVisible()));
            });
            $scope.$emit('renderDateTimeFilter');
        });

        google.maps.event.addListener(polygon, 'mouseover', function (event) {
            // Within the event listener, "this" refers to the polygon which
            // received the event.
            this.setOptions({
                strokeColor: '#b3ffb3',
                fillColor: '#ccffcc'
            });
        });
        google.maps.event.addListener(polygon, 'mouseout', function (event) {
            this.setOptions({
                strokeColor: '#ff8080',
                fillColor: '#ff8080'
            });
        });        
    }

    return {
        getZoomByBounds: getZoomByBounds,
        requestData: requestData,
        addEventListeners: addEventListeners
    };
});