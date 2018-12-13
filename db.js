var options = {
    // initialization options;
};

const pgp = require("pg-promise")(options);
//変数
const DB_URL = process.env.DATABASE_URL;

var db = pgp(DB_URL);

module.exports = db;
