define(function () {
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
        // column is determined by datasetType
        addFilter(datasetType, values) {
            if (!this.hasWhereClause) {
                if (this.hasPreviousClause) this.url += '&'
                else this.url += '?'
                this.url += '$where=';
                this.hasWhereClause = true;
                this.hasPreviousClause = true;
            } else {
                this.url += ' AND ';
            }

            var column = datasetType === 'crime' ? 'offense_code_group'
            // todo: filter var for 311 data
                                                 : 'tbd';
            this.url += column + ' in('
            _.forEach(values, value => this.url += "'" + value + "', ");
            this.url = this.url.substring(0, this.url.length - 2);
            this.url += ')';
            return this;
        }

        // todo: addFilter(column, min, max) to filter on min < col val < max
    }
});