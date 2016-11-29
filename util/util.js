﻿define(['lodash', 'd3', 'util/UrlBuilder', 'google_map'], function (_, d3, UrlBuilder) {
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
        var urlBuilder = new UrlBuilder(datasetType).limit(1000);
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

    function addEventListeners(polygon, map, region_neighborhood_ht) {
        google.maps.event.addListener(polygon, 'click', function (event) {
            _.forOwn(region_neighborhood_ht, (value, key) => {
                if (value.indexOf(this) !== -1) {
                    // todo: update sidebar etc.
                    // key is the name of the neighborhood
                    //alert(key);
                }
            });
            map.setCenter(this.getBounds().getCenter());
            map.setZoom(getZoomByBounds(map, this.getBounds()));
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

    return {
        getZoomByBounds: getZoomByBounds,
        requestData: requestData,
        addEventListeners: addEventListeners
    };
});