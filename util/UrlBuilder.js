define(['d3'], function (d3) {
    return class UrlBuilder {
        // type: 'crime' or '311'
        constructor(datasetType) {
            if (datasetType === 'crime') {
                this.url = 'https://data.cityofboston.gov/resource/29yf-ye7n.json';
                this.url += '?$select=hour,lat,long,occurred_on_date,offense_code_group,offense_description,street';
            } else {
                this.url = 'https://data.cityofboston.gov/resource/wc8w-nujj.json';
                this.url += '?$select=case_title,closure_reason,latitude,longitude,neighborhood,open_dt,reason,subject';
            }
            this.hasWhereClause = false;
            this.hasPreviousClause = true;
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
        addInFilter(column, values) {
            this.appendTemplate();
            this.url += column + ' in('
            _.forEach(values, value => this.url += '"' + encodeURIComponent(value) + "\", ");
            this.url = this.url.substring(0, this.url.length - 2);
            this.url += ')';
            return this;
        }

        // add to where clause AND column op value
        // ex: id > 10
        addCmpFilter(column, op, value) {
            var quote = '"';
            if (typeof value === "string"){
                var tryParseDate = new Date(value);
                if (tryParseDate instanceof Date) value = tryParseDate;
            }
            if (value instanceof Date) {
                // ISO8601 Times with no timezone offset
                value = d3.isoFormat(value).slice(0, -1);
            }
            if (typeof value === 'number') quote = '';
            this.appendTemplate();
            this.url += column + encodeURIComponent(`${op}${quote}${value}${quote}`);
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