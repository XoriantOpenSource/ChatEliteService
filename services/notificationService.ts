import { config } from "t-webapi";
import userModel from "../schema/users";
import chatModel from "../schema/chat";
import deviceModel from "../schema/devices";
import apiService from "../services/apiService";
import { platform, chatType, onlineStatus } from "../constants/enums";

/**
 * @class
 * @classdesc Consists of all methods where notification(s) come into picture
 */
export default class notificationService {

    /**
     * @function sendNotify
     * @param data Data to be sent
     * @param url URL of notification Web Object
     * @param authorizationKey Authorization key of firebase for push notification(s)
     * @description Sends a notification
     */
    public static async sendNotify(data, url, authorizationKey = 0) {
        apiService.postRawFormData(data, url, authorizationKey);
    }

    /**
     * @function sendNotification
     * @param user User details of a particular user
     * @param data Information about the chat message
     * @description Sends a notification
     */
    public static async sendNotification(user, data) {
        try {
            let message: any;
            let mobile: any;
            let web: any;
            let allUsers: any = await new chatModel().find({ _id: data.groupId }, { isP2PChat: 1, subject: 1, users: 1 });
            allUsers = allUsers[0];
            data.is_p2p = allUsers.isP2PChat;
            data.title = data.is_p2p ? user.user_name : allUsers.subject;
            if (data.type === chatType.text) {
                if (data.text) {
                    message = data.text;
                    data.text = message;
                }
            } else if (data.type === chatType.message) {
                message = data.text;
                if (message) {
                    if (message.indexOf("<strong>") !== -1) {
                        message = message.replace(/strong/g, "");
                        message = message.replace(/[<]/g, "");
                        message = message.replace(/[>]/g, "");
                        message = message.replace(/[/]/g, "");
                    }
                    data.text = message;
                }
            } else if (data.type === chatType.doc) {
                if (data.text) {
                    message = "File Uploaded" + " " + data.text;
                    data.text = message;
                }
            } else {
                message = data.text;
                data.text = message;
            }
            mobile = Object.assign({}, data);

            if (data.type !== chatType.message && !data.is_p2p) {
                const tempMsg = user.user_name + " : " + data.text;
                data.text = tempMsg;
            }
            web = Object.assign({}, data);

            const userIds: any = await new userModel().aggregate([{ $match: { _id: { $in: allUsers.users } } }, { $project: { user_id: 1, online_status: 1 } }]);
            const userdevIds: any = [];
            userIds.forEach((userObj) => {
                if (userObj.user_id !== user.user_id && userObj.online_status !== onlineStatus.online) {
                    userdevIds.push(userObj.user_id);
                }
            });
            if (userdevIds.length) {
                const devIds: any = await new deviceModel().aggregate([
                    { $match: { user_id: { $in: userdevIds } } },
                    { $unwind: "$device" },
                    { $match: { "device.is_active": true, "device.platform": { $in: [platform.web] } } },
                    { $group: { _id: "$device.os", device_ids: { $push: "$device.device_id" } } }
                ]);

                devIds.forEach((doc) => {
                    switch (doc._id) {

                        case 3: // firefox
                            this.webNotify(doc.device_ids, user, web);
                            break;
                        case 4: // chrome
                            this.webNotify(doc.device_ids, user, web);
                            break;
                        // case 5: for other any browser
                        //     break;
                        default:
                            break;
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * @function webNotify
     * @param webDevIds Array of device IDs where web app runs
     * @param user User details of a particular user
     * @param data Message information
     * @description Notifies the web application
     */
    public static async webNotify(webDevIds, user, data) {
        webDevIds.forEach((token) => {
            const notifyData = {
                notification: {
                    title: data.title,
                    body: data.text,
                    click_action: "https://chatelite.xoriant.com",
                    tag: data.groupId,
                    icon: "data:image/png;base64,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"
                },
                to: token
            };
            this.sendNotify(notifyData, config.appSettings.notification.firebaseObject.url, config.appSettings.notification.firebaseObject.authorization_key);
        });
    }

}
