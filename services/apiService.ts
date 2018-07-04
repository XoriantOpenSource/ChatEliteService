import userModel from "../schema/users";
import chatModel from "../schema/chat";
const request: any = require("request");

/**
 * @class
 * @classdesc Performs HTTP requests for external APIs
 */
export default class apiService {

    /**
     * @function postDataFormEncoded
     * @param data Information to be sent i.e POST parameters
     * @param urls URL of the REST api to be hit
     * @returns A promise object
     * @description Performs POST requests for MIME type application/x-www-form-urlencoded for external api
     */
    public static postDataFormEncoded(data, urls) {
        const options = {
            rejectUnauthorized: false,
            url: urls,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            form: data

        };

        return new Promise((resolve, reject) => {
            request.post(options, (error: any, response: any, body: any) => {
                if (error) {
                    reject(error);
                } else if (response.statusCode !== 200) {
                    reject(response.statusCode);
                } else {
                    resolve(body);
                }
            });
        });

    }

    /**
     * @function getData
     * @param urls URL of the REST api to be hit
     * @returns Response object from the url hit
     * @description Performs a GET request for external api
     */
    public static getData(urls) {
        return new Promise((resolve, reject) => {
            const options = {
                rejectUnauthorized: false,
                url: urls
            };
            request.get(options, (error: any, response: any, body: any) => {
                if (error) {
                    reject(error);
                } else if (response.statusCode !== 200) {
                    reject(response.statusCode);
                } else {
                    resolve(body);
                }
            });
        });
    }

    /**
     * @function postRawFormData
     * @param data POST request parameters
     * @param urls URL of the REST api to be hit
     * @param authorizationKey auth key used for notification
     * @returns Response object from the url hit
     * @description Performs a POST request for MIME type application/json. Here, it is used for sending notifications.
     */
    public static postRawFormData(data, urls, authorizationKey) {
        const options: any = {
            rejectUnauthorized: false,
            url: urls,
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: data,
            json: true
        };
        if (authorizationKey) {
            options.headers.authorization = authorizationKey;
        }

        return new Promise((resolve, reject) => {
            request.post(options, (error: any, response: any, body: any) => {
                if (error) {
                    reject(error);
                } else if (response.statusCode !== 200) {
                    reject(response.statusCode);
                } else {
                    resolve(body);
                }
            });
        });
    }
}
