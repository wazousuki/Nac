"use strict";

// モジュールインポート
const express = require("express");
const server = express();
const bodyParser = require("body-parser");
const jwt = require('jsonwebtoken');
const https = require("https");
const request = require("request");
const qs = require("querystring");

//変数
const APIID = process.env.APIID;
const SERVERID = process.env.SERVERID;
const CONSUMERKEY = process.env.CONSUMERKEY;
const PRIVATEKEY = process.env.PRIVATEKEY;
const BOTNO = process.env.BOTNO;
const DB_URL = process.env.DATABASE_URL;

///////////////////////////////////////////////
var options = {
    // initialization options;
};
const pgp = require("pg-promise")(options);
var db = pgp(DB_URL);
module.exports = db;
///////////////////////////////////////////////

server.use(bodyParser.json());

// Webアプリケーション起動
var app = server.listen(process.env.PORT || 3000, function(){
    console.log("Node.js is listening to PORT:" + app.address().port);
});

// サーバー起動確認
server.get('/', (req, res) => {
    res.send('Hello World!');
});

// 10秒置きにデータを確認
setInterval(function() {
    db.any("SELECT * FROM public.\"APPROVALREQUEST\" WHERE \"APPROVAL\"=${approval}", {approval:0})
      .then(function (data) {
        // success;
        var applyNo = data[0].REQUESTNO;
        var message = data[0].MESSAGE;
        var name_authorizer= data[0].NAME_AUTHORIZER
        var accountId_authorizer= data[0].LINEWORKSACCOUNT_AUTHORIZER
        var accountId_staff = data[0].LINEWORKSACCOUNT_STAFF
        getJWT((jwttoken) => {
            getServerToken(jwttoken, (newtoken) => {
                sendMessageButton(newtoken, applyNo, accountId_authorizer, message, accountId_staff, name_authorizer);
            });
        });
        console.log(data);

        db.none("UPDATE public.\"APPROVALREQUEST\" SET \"APPROVAL\"=${approval} WHERE \"REQUESTNO\"=${applyNo}", {approval:1 , applyNo:applyNo})
        .then(function (data) {
          // success;
          console.log(data);
        })
        .catch(function (error) {
    　　　　 // error;
          console.log(error);
        });

      })
      .catch(function (error) {
　　　　 // error;
        console.log(error);
      });
}, 10000);

// Botからメッセージに応答
server.post('/callback', (req, res) => {
    res.sendStatus(200);

    const rsvmessage = req.body.content.text;
    const roomId = req.body.source.roomId;
    const accountId = req.body.source.accountId;
    const returnValue = req.body.content.postback;
    var sendmessage = "";
    var split = returnValue.split(",");

    if(split[0] == "RTN_OK"){
      db.none("UPDATE public.\"APPROVALREQUEST\" SET \"APPROVAL\"=${approval} WHERE \"REQUESTNO\"=${applyNo}", {approval:4, applyNo:split[1]})
      .then(function (data) {
        // success;
        getJWT((jwttoken) => {
            getServerToken(jwttoken, (newtoken) => {
                sendMessageText(newtoken, split[2], "有給休暇申請が承認されました" + " (" + split[3] + ")");
                sendMessageText(newtoken, accountId, "承認の旨を通知しました");
            });
        });
        console.log(data);
//        getJWT((jwttoken) => {
//            getServerToken(jwttoken, (newtoken) => {
//                sendMessageText(newtoken, accountId, "承認の旨を通知しました");
//            });
//        });
      })
      .catch(function (error) {
　　　　 // error;
        console.log(error);
      });
    }else if(split[0] == "RTN_NO"){
      db.none("UPDATE public.\"APPROVALREQUEST\" SET \"APPROVAL\"=${approval} WHERE \"REQUESTNO\"=${applyNo}", {approval:2 , applyNo:split[1]})
      .then(function (data) {
        // success;
        getJWT((jwttoken) => {
            getServerToken(jwttoken, (newtoken) => {
                sendMessageText(newtoken, split[2], "有給休暇申請は承認されませんでした" + " (" + split[3] + ")");
                sendMessageText(newtoken, accountId, "不承認の旨を通知しました");
          });
        });
        console.log(data);
//        getJWT((jwttoken) => {
//            getServerToken(jwttoken, (newtoken) => {
//                sendMessageText(newtoken, accountId, "不承認の旨を通知しました");
//            });
//        });
      })
      .catch(function (error) {
　　　　 // error;
        console.log(error);
      });
    }

});

//サーバーAPI用JWT取得
function getJWT(callback){
    const iss = SERVERID;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + (60 * 60);　//JWTの有効期間は1時間
    const cert = PRIVATEKEY;
    const token = [];
    const jwttoken = jwt.sign({"iss":iss, "iat":iat, "exp":exp}, cert, {algorithm:"RS256"}, (err, jwttoken) => {
        if (!err) {
            callback(jwttoken);
        } else {
            console.log(err);
        }
    });
}

function getServerToken(jwttoken, callback) {
    const postdata = {
        url: 'https://authapi.worksmobile.com/b/' + APIID + '/server/token',
        headers : {
            'Content-Type' : 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        form: {
            "grant_type" : encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer"),
            "assertion" : jwttoken
        }
    };
    request.post(postdata, (error, response, body) => {
        if (error) {
            console.log(error);
            callback(error);
        } else {
            const jsonobj = JSON.parse(body);
            const AccessToken = jsonobj.access_token;
            callback(AccessToken);
        }
    });
}

function sendMessageText(token, accountId, message) {
    const postdata = {
        url: 'https://apis.worksmobile.com/' + APIID + '/message/sendMessage/v2',
        headers : {
          'Content-Type' : 'application/json;charset=UTF-8',
          'consumerKey' : CONSUMERKEY,
          'Authorization' : "Bearer " + token
        },
        json: {
            "botNo" : Number(BOTNO),
            "accountId" : accountId,
            "content" : {
                "type" : "text",
                "text" : message
            }
        }
    };
    request.post(postdata, (error, response, body) => {
        if (error) {
          console.log(error);
        }
        console.log(body);
    });
}

function sendMessageButton(token, applyNo, accountId_authorizer, message, accountId_staff, name_authorizer) {
    const postdata = {
        url: 'https://apis.worksmobile.com/' + APIID + '/message/sendMessage/v2',
        headers : {
          'Content-Type' : 'application/json;charset=UTF-8',
          'consumerKey' : CONSUMERKEY,
          'Authorization' : "Bearer " + token
        },
        json: {
            "botNo" : Number(BOTNO),
            "accountId" : accountId_authorizer,
            "content" : {
                "type" : "buttonTemplate",
                "contentText": message,
                "buttons" : [{
                  "text": "承認する",
                  "postback": "RTN_OK," + applyNo + "," + accountId_staff + "," + name_authorizer
                },{
                  "text": "承認しない",
                  "postback": "RTN_NO," + applyNo + "," + accountId_staff + "," + name_authorizer
                }]
            }
        }
    };
    request.post(postdata, (error, response, body) => {
        if (error) {
          console.log(error);
        }
        console.log(body);
    });
}
