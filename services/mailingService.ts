import { config } from "t-webapi";
import userModel from "../schema/users";
import chatModel from "../schema/chat";

/*!
 * Node-sendmail v1.1.1
 * Copyright (c) 2014 -2017 Guileen
 * Copyright (c) 2016 -2018 Green Pioneer
 * Licensed under MIT (https://github.com/guileen/node-sendmail/blob/master/LICENSE)
!*/
const email = require("sendmail")();
import { onlineStatus } from "../constants/enums";
import { settings } from "cluster";

/**
 * @class
 * @classdesc Contains methods when a mail is to be sent
 */
export default class mailingService {
    public static p2pChatsUsers: any = [];
    public static groupChatsUsers: any = [];

    /**
     * @function sendEmailtoOfflineUsers
     * @param $user User details of the request sender
     * @param $data  Details of a particular message that the users' must be notified via email
     * @description Sends an email to offline users from a particular conversation group in which the message is sent
     */
    public static async sendEmailtoOfflineUsers($user, $data) {
        const populateArr = [{ path: "created_by_user" }];
        let group: any = await new chatModel().findAndPopulate({ _id: $data._id }, populateArr, "subject isP2PChat users created_by_user");
        group = group[0];
        if (group.isP2PChat) {
            let user = group.users.filter((obje: any) => {
                return $user._id !== obje.toString();
            });
            user = await new userModel().findByPrimaryKey(user);
            const obj = {
                user_id: user.id,
                group_id: group.id
            };

            if (user.online_status === onlineStatus.offline && user.email_id) {
                if (group.subject === $user.user_name) {
                    group.subject = group.created_by_user.user_name;
                }
                if (!(this.p2pChatsUsers.filter((e) => {
                    const con = e.user_id === obj.user_id && e.group_id === obj.group_id;
                    return con;
                }).length > 0)) {
                    this.p2pChatsUsers.push(obj);
                    this.sendOfflineUserEmail(user.email_id, $user, group);
                }
            }
        } else {
            const users = group.users.filter((obj: any) => {
                return $user._id !== obj.toString();
            });
            for (let user of users) {
                user = await new userModel().findByPrimaryKey(user);
                const obj = {
                    user_id: user.id,
                    group_id: group.id
                };

                if (user.online_status === onlineStatus.offline && user.email_id) {
                    if (!(this.groupChatsUsers.filter((e) => {
                        const con = e.user_id === obj.user_id && e.group_id === obj.group_id;
                        return con;
                    }).length > 0)) {
                        this.groupChatsUsers.push(obj);
                        this.sendOfflineUserEmail(user.email_id, $user, group);
                    }
                }
            }
        }
    }

    /**
     * @function sendOfflineUserEmail
     * @param emailIds EmailID(s) where the mails are to be sent
     * @param  $user User details of the request sender
     * @param group Conversation details
     * @description Sends an e-mail to users who are offline, if a message is sent to them
     */
    public static async sendOfflineUserEmail(emailIds: string | string[], $user, group) {
        const mailContent = group.isP2PChat ? $user.user_name + " has sent you a personal message" : $user.user_name + " has messaged you in " + group.subject;
        email({
            from: config.appSettings.email.emailObject.notificationEmailId,
            to: emailIds,
            subject: "Message from " + $user.user_name + " on Chat Application!",
            html: mailContent + "." + "<br><br><br>url : " + config.appSettings.email.emailObject.applicationUrl
        }, (error: any, reply: any) => { });
    }

}
