
import { api, apiControllerBase } from "t-webapi";
import * as  path from "path";
const version = "v1";
import chatModel from "../schema/chat";
import userModel from "../schema/users";
import docModel from "../schema/documents";
import * as fs from "fs";
import { onlineStatus, chatType } from "../constants/enums";

/*!
 * Json2csv v6.7.7
 * Copyright (C) 2012 Mirco Zeiss <mirco.zeiss@gmail.com>
 * Licensed under MIT (https://github.com/zemirco/json2csv/blob/master/LICENSE.md)
!*/
import * as json2csv from "json2csv";

/**
 * @class
 * @classdesc Handles all api calls related to discussions
 * @extends apiControllerBase
 */
export class discussionController extends apiControllerBase {

    /**
     * @function getReadmessages
     * @param group_id  The id of the group containing the message
     * @param chat_id  The id of the message which has to be found whether read or not
     * @returns  Returns all the username(s) of user(s) who have read a particular message
     * @description Whenever the user hovers over the tick icon of a message, the api is hit and it gives the user the list of all other users' usernames and also displays at what time a user has read the particular message.
     */
    @api({
        url: "/messages/read/:group_id/chat/:chat_id",
        authorize: true
    })
    public async getReadmessages($params) {
        // getting chat realated information
        const group: any = await new chatModel().findAndPopulate({ "_id": $params.group_id, "conversations._id": $params.chat_id },
            [{ path: "conversations.readBy.user" }], "conversations.$.readBy.user.user_name");

        let temp: any;
        if (group.legnth) {
            // creating a temp of all user who has read the message.
            const uniqueUser = [];
            temp = group[0].conversations[0].readBy.map((val: any) => {
                // pushing only the unique userID.
                if (uniqueUser.indexOf(val.user.user_id) < 0) {
                    uniqueUser.push(val.user.user_id);
                    return {
                        read_date: val.read_date,
                        user_name: val.user.user_name
                    };
                }
            }).filter((val) => {
                // removing the undefined values generated from .map
                if (val !== undefined) {
                    return val;
                }
            });
        }
        if (temp && temp.length !== 0) {
            return this.success(temp);
        } else {
            return this.success([]);
        }
    }

    /**
     * @function postReadmessages
     * @param $user User details
     * @param $data Array of messages to be marked as read
     * @description Whenever a user scrolls over a message, the api marks that message as read by that user.
     */
    @api({
        url: "/readmessages",
        authorize: true
    })
    public async postReadmessages($user, $data: any) {
        const user: any = await new userModel().findOne({ user_id: $user.user_id });
        for (const group of $data) {
            if (group.group_id) {
                // pulling all the conversation
                const grp: any = await new chatModel().findOne({ _id: group.group_id });
                for (const converse of group.conversations) {
                    if (converse.chat_id) {
                        const tempReadBy = {
                            user: user._id,
                            read_date: converse.read_date
                        };
                        // getting the conversation
                        const con = grp.conversations.find((val: any) => val._id === converse.chat_id);
                        // getting the readby of the conversation and checking for the user if it exists
                        const readByObj = con.readBy ? con.readBy.find((val: any) => {
                            return (val.user.toString() === user._id);
                        }) : con.readBy;
                        // if user doesnt exists
                        if (!readByObj) {
                            if (!con.readBy) {
                                con.readBy = [];
                            }
                            con.readBy.push(tempReadBy);
                        }
                    }
                }
                await new chatModel().updateById(grp._id, grp);
            }
        }
        return this.success({});
    }

    /**
     * @function postUpload
     * @param $files File information to be sent
     * @param $data Consists of conversation details in which the file is sent and user information who sent it
     * @returns Name of the file sent
     * @description Uploads a document
     */
    @api({
        url: "/files/upload",
        isUpload: {
            extensions: [".jpeg", ".png", ".gif", ".jpg", ".pdf", ".docx", ".xlsx", ".doc", ".xls", ".pptx", ".txt", ".zip", ".rar", ".7z"],
            size: 10
        },
        authorize: true
    })
    public async postUpload($files, $data) {
        const uploadPath = path.dirname(require.main.filename) + "/uploads";
        const isFolderExists = fs.existsSync(uploadPath);

        if (!isFolderExists) {
            fs.mkdirSync(uploadPath);
        }

        const file = $files.file[0];
        const fileData: any = await new docModel().create({ originalFilename: file.originalFilename });
        const fileExtensions = file.originalFilename.split(".");
        const fileExtension = fileExtensions[fileExtensions.length - 1];
        fs.createReadStream(file.path).pipe(fs.createWriteStream(uploadPath + "/" + fileData.id + "." + fileExtension));
        const socketID = [];
        const user: any = await new userModel().findByPrimaryKey($data.currentUserId);
        socketID.push(user.socket_id);
        fileData._doc.group_id = $data.group_id;
        return this.success(fileData);
    }

    /**
     * @function getUpload
     * @param file_id ID of the document to be downloaded
     * @description  We have the provision of sending document(s). This api allows you to download a particular document. Whenever user clicks on the document, it is downloaded.
     */
    @api({
        url: "/files/download/:file_id",
        isDownload: true
    })
    public async getUpload($params) {
        const document: any = await new docModel().findByPrimaryKey($params.file_id);
        const fileExtensions = document.originalFilename.split(".");
        const fileExtension = fileExtensions[fileExtensions.length - 1];
        return this.download(path.dirname(require.main.filename) + "/uploads/" + $params.file_id + "." + fileExtension);
    }

    /**
     * @function getChats
     * @param  group_id ID if the conversation group whose chats are to be downloaded
     * @description Download a conversation
     * @returns Conversation in a csv format file
     * @description An entire conversation amongst two users or a group of users can be downloaded. Whenever the user clicks on 'download a chat' option, the entire conversation is stored in a csv formmated file and downloaded to your system.
     */
    @api({
        url: "/files/download/chat/:group_id",
        isDownload: true
    })
    public async getChats($params) {
        const populateArr = [{ path: "created_by_user" }, { path: "conversations.created_by_user" }];
        let group: any = await new chatModel().findAndPopulate({ _id: $params.group_id }, populateArr, "subject created_by_user created_date_time users conversations.created_by_user conversations.text conversations.created_date_time");
        group = group[0];
        group._doc.created_by_user = group.created_by_user.user_name;

        for (const converse of group.conversations) {
            converse._doc.created_by_user = converse.created_by_user.user_name;
            converse._doc.created_date_time = converse.created_date_time.toString();
        }

        const downloadPath = path.dirname(require.main.filename) + "/downloads";
        const isFolderExists = fs.existsSync(downloadPath);

        if (!isFolderExists) {
            fs.mkdirSync(downloadPath);
        }

        let fileName;
        const dateString = new Date().toISOString().replace(new RegExp(":", "g"), ".") + "";
        if (group._doc.users.length <= 2) {
            delete group._doc.subject;
            fileName = dateString + ".csv";
        } else {
            fileName = group.subject + "_" + dateString + ".csv";
        }
        delete group._doc._id;
        delete group._doc.users;

        const fieldsJSON = ["created_by_user", "text", "created_date_time"];
        const fieldNamesJSON = ["User", "Message", "Created Date and Time"];

        const data = json2csv({ data: group.conversations, fields: fieldsJSON, fieldNames: fieldNamesJSON });
        const x = new Promise((resolve, reject) => {
            fs.writeFile(downloadPath + "/" + fileName, data, (error: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        await x;
        return this.download(downloadPath + "/" + fileName);

    }

    /**
     * @function postUnsetUnreadMsgscount
     * @param  $user User details
     * @param  $data ID of the conversation whose unread messages are to be set to read
     * @description Whenever the application opens up a user might have unread messages in a conversation group. On clicking on that particular group this api sets all unread messages as read messages.
     */
    @api({
        url: "/unsetUnreadMsgscount",
        authorize: true
    })
    public async postUnsetUnreadMsgscount($user, $data: any) {
        $data.date = new Date().toISOString();
        const user: any = await new userModel().findOne({ user_id: $user.user_id });
        const grp: any = await new chatModel().findOne({ _id: $data._id });
        const arr: any = await new chatModel().aggregate([{ $match: { _id: grp._id } },
        { $unwind: "$conversations" },
        { $match: { "conversations.created_by_user": { $ne: user._id } } },
        { $match: { "conversations.type": "text" } },
        { $match: { "conversations.isDropped": false } },
        { $match: { "conversations.readBy.user": { $nin: [user._id] } } },
        { $project: { _id: 1, conversations: 1 } }
        ]);
        let x: any;
        for (x of arr) {
            const n: any = await new chatModel().update({ "_id": x._id, "conversations._id": x.conversations._id }, {
                $push: {
                    "conversations.$.readBy": {
                        user: user._id,
                        read_date: $data.date
                    }
                }
            });
        }
        return this.success({});
    }

}
