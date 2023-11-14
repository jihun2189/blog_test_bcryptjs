const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://jihun:as123123@cluster0.ilaxk2k.mongodb.net/?retryWrites=true&w=majority";

module.exports = function(callback){ // 이렇게 사용하면 몽고디비 uri를 몰라도 사용할 수 있음
    return MongoClient.connect(uri, callback);
}