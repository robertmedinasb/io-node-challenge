"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var uuid_1 = require("uuid");
var region = process.env.AWS_REGION;
var activityTableName = process.env.ACTIVITY_TABLE_NAME;
var dynamoDBClient = new client_dynamodb_1.DynamoDBClient({ region: region });
var registerActivity = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var records, registersToAdd_1, requestWriteItems, batchWriteItemCommand, response, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                console.log("records", JSON.stringify(event.Records));
                records = event.Records;
                registersToAdd_1 = [];
                records.map(function (_a) {
                    var eventName = _a.eventName, record = __rest(_a, ["eventName"]);
                    if (eventName == "INSERT")
                        registersToAdd_1.push(record.dynamodb.NewImage);
                });
                requestWriteItems = registersToAdd_1.map(function (_a) {
                    var transactionId = _a.transactionId;
                    return ({
                        PutRequest: {
                            Item: {
                                transactionId: { S: transactionId.S },
                                activityId: { S: (0, uuid_1.v4)().toString() },
                                date: { S: new Date().toISOString() },
                            },
                        },
                    });
                });
                if (!registersToAdd_1.length) return [3 /*break*/, 2];
                batchWriteItemCommand = new client_dynamodb_1.BatchWriteItemCommand({
                    RequestItems: (_a = {},
                        _a[activityTableName] = requestWriteItems,
                        _a),
                });
                return [4 /*yield*/, dynamoDBClient.send(batchWriteItemCommand)];
            case 1:
                response = _b.sent();
                console.log("response", response);
                if (response.$metadata.httpStatusCode === 200) {
                    return [2 /*return*/, {
                            batchItemFailures: event.Records.map(function (_a) {
                                var dynamodb = _a.dynamodb;
                                return ({
                                    itemIdentifier: dynamodb.Keys.transactionId.S,
                                });
                            }),
                        }];
                }
                _b.label = 2;
            case 2: return [3 /*break*/, 4];
            case 3:
                error_1 = _b.sent();
                console.log("ERROR", error_1);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/, {
                    batchItemFailures: [],
                }];
        }
    });
}); };
exports.handler = registerActivity;
