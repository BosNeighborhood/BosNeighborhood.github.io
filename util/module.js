define(['util/util', 'util/init', 'util/render'], function (util, init, render) {
    return {
        getZoomByBounds: util.getZoomByBounds,
        requestData: util.requestData,

        initMap: init.initMap,

        render: render.render,
        initBrush: render.initBrush,
        updateDateTimeFilter: render.updateDateTimeFilter
    };
});