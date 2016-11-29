define(['d3'], function (d3) {
    return class UrlBuilder {
        // type: 'crime' or '311'
        constructor(datasetType) {
            if (datasetType === 'crime')
                this.url = 'https://data.cityofboston.gov/resource/29yf-ye7n.json';
            else
                this.url = 'https://data.cityofboston.gov/resource/wc8w-nujj.json';
            this.hasWhereClause = false;
            this.hasPreviousClause = false;
        }

        // add $limit=value
        limit(value) {
            if (this.hasPreviousClause) this.url += '&'
            else this.url += '?'
            this.hasPreviousClause = true;
            this.url += '$limit=' + value;
            return this;
        }

        // add to where clause AND column in ('v1', 'v2', ..)
        addFilter(column, values) {
            this.appendTemplate();
            this.url += column + ' in('
            _.forEach(values, value => this.url += '"' + encodeURIComponent(value) + "\", ");
            this.url = this.url.substring(0, this.url.length - 2);
            this.url += ')';
            return this;
        }

        // add to where clause AND column op value
        // ex: id > 10
        addFilter(column, op, value) {
            if (value instanceof Date) {
                // ISO8601 Times with no timezone offset
                value = d3.isoFormat(value).slice(0, -1);
            }
            this.appendTemplate();
            this.url += column + encodeURIComponent(`${op}"${value}"`);            
            return this;
        }

        appendTemplate() {
            if (!this.hasWhereClause) {
                if (this.hasPreviousClause) this.url += '&'
                else this.url += '?'
                this.url += '$where=';
                this.hasWhereClause = true;
                this.hasPreviousClause = true;
            } else {
                this.url += ' AND ';
            }
        }

        // todo: addFilter(column, min, max) to filter on min < col val < max
    }
});