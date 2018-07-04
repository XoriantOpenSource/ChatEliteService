import { _, realTime, realTimeBase, config } from "t-webapi";
import userModel from "../schema/users";
import chatModel from "../schema/chat";
import emailService from "../services/mailingService";
import { chatType } from "../constants/enums";
import * as fs from "fs";
import * as  path from "path";
import getService from "../services/getService";
import common from "../services/commonService";
import notificationService from "../services/notificationService";
/**
 * @class
 * @classdesc Consists of all socket apis relating to a conversation group activites
 * @extends realTimeBase
 */
export class conversationSocket extends realTimeBase {

    private pageLength: number = 20;

    /**
     * @function chats
     * @param  $user User details of the requestor
     * @param  $data Data of the message to be sent
     * @description Allows to send a message in a conversation. The sent message is stored in database.
     */
    @realTime
    public async chats($user, $data) {
        if (config.appSettings.email.enable && $data.type !== chatType.message) {
            emailService.sendEmailtoOfflineUsers($user, $data);
        }
        const groupId = $data._id;
        delete $data._id;
        $data.created_by_user = $user._id;
        const obj: any = await new chatModel().update({ _id: groupId },
            {
                $push: { conversations: $data },
                $set: {
                    last_access_date: new Date().toISOString()
                }
            });
        $data.created_date_time = new Date().toISOString();
        $data.created_by_user = $user;
        const group = await new chatModel().find({ _id: groupId }, {
            conversations: {
                $slice: -1
            }
        });
        $data._id = group[0].conversations[0].id;
        $data.favorite = [];
        $data.groupId = groupId;
        /**
         * Emit to all sockets joined to a particular group
         */
        this.emitToGroup(groupId, { type: "chats", data: $data });
        if (/(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm.test($data.text)) {
            const linkData = {
                txt: [$data.text],
                created_date_time: $data.created_date_time,
                chat_id: $data._id
            };
            const socketIds = [];
            const arr: any = await getService.socketIoServicesInstance().groupBroadcast(groupId, $user._id);
            arr.forEach((element) => {
                socketIds.push.apply(socketIds, element.socket_id);
            });
            getService.socketIoServicesInstance().emitToSelf($user._id, { type: "addToLinks", data: linkData });
            this.broadcastToSockets(socketIds, { type: "addToLinks", data: linkData });
        }
        if (config.appSettings.notification.enable) {
            if ($data.type === chatType.text || $data.type === chatType.message || $data.type === chatType.doc) {
                notificationService.sendNotification($user, $data);
            }
        }
    }

    /**
     * @function conversation
     * @param  $user User details of the requestor
     * @param  $data ID of the conversation group
     * @description Particulars of the group containing all the messages are returned to a user.
     */
    @realTime
    public async conversation($user, $data) {
        const populateArr = [{ path: "created_by_user" }, { path: "users" }];
        const group: any = await new chatModel().findAndPopulate({ _id: $data._id }, populateArr, "subject created_by_user users isP2PChat");
        this.emit({ type: "conversation", data: group[0] });
    }

    /**
     * @function chatHistory
     * @param  $user User details of the requestor
     * @param  $data ID of the conversation group
     * @description Whenever a user clicks on a user name or a group name, the conversation with that particular group opens up. The chatHistory gives us the recent 20 messages of that particular conversation that must be displayed.
     */
    @realTime
    public async chatHistory($user, $data) {
        const populateArr = [{ path: "conversations.created_by_user" }];
        let group: any = await new chatModel().findByPrimaryKey($data._id, "_id");
        let params: any = [{ $match: { _id: group._id } },
        {
            $project: { count: { $size: "$conversations" } }
        }];
        const obj: any = await new chatModel().aggregate(params);
        let startIndex = obj[0].count - this.pageLength;
        if (startIndex < 0) {
            startIndex = 0;
        }
        params = [{ $match: { _id: group._id } },
        {
            $project: {
                conversations: { $slice: ["$conversations", startIndex, this.pageLength] }
            }
        },
        { $unwind: "$conversations" },
        { $match: { "conversations.isDropped": false } },
        { $project: { conversations: 1 } },
        {
            $group:
                {
                    _id: "$_id",
                    conversations: { $push: "$conversations" }
                }
        }];
        if (obj[0].count) {
            group = await new chatModel().aggregateAndPopulate(params, populateArr, "user");
            group[0].chatTotalCount = obj[0].count;
        } else {
            group = await new chatModel().findAndPopulate({ _id: $data._id }, populateArr, "conversations");
            group[0]._doc.chatTotalCount = obj[0].count;
        }
        for (const converse of group[0].conversations) {
            if (!converse.favorite) {
                converse.favorite = [];
            }
        }
        this.emit({ type: "chatHistory", data: group[0] });
    }

    /**
     * @function chatHistoryUpdation
     * @param  $user User details of the requestor
     * @param  $data Conversation details like ID,chatcount,page no of the conversation
     * @description When a user scrolls up, the previous messages of the group are displayed.
     */
    @realTime
    public async chatHistoryUpdation($user, $data) {
        const populateArr = [{ path: "conversations.created_by_user" }];
        let startIndex = $data.chatTotalCount - $data.pageNo * this.pageLength - this.pageLength;
        let endIndex = $data.chatTotalCount - $data.pageNo * this.pageLength;
        if (startIndex < 0) {
            startIndex = 0;
        }
        if (endIndex > 20) {
            endIndex = this.pageLength;
        }
        let group: any = await new chatModel().findByPrimaryKey($data._id, "_id");
        const params = [{ $match: { _id: group._id } },
        {
            $project: {
                conversations: { $slice: ["$conversations", startIndex, endIndex] }
            }
        },
        { $unwind: "$conversations" },
        { $match: { "conversations.isDropped": false } },
        { $project: { conversations: 1 } },
        {
            $group:
                {
                    _id: "$_id",
                    conversations: { $push: "$conversations" }
                }
        }];
        group = await new chatModel().aggregateAndPopulate(params, populateArr, "user");
        for (const converse of group[0].conversations) {
            if (!converse.favorite) {
                converse.favorite = [];
            }
        }
        this.emit({ type: "chatHistoryUpdation", data: group[0] });
    }

    /**
     * @function typing
     * @param  $user User details of the requestor
     * @param $data ID of the conversation group that the other user is typing in a message
     * @description In a group, whenever other user is responding to a message one must be informed. The typing api displays '...other username is typing' when other user is typing a message on our screen.
     */
    @realTime
    public async typing($data, $user) {
        this.emitToGroup($data._id, { type: "typing", data: $user });
    }

    /**
     * @function deleteMessage
     * @param  $user User details of the requestor
     * @param  $data Data about the message that is to be deleted from the group
     * @description A user can delete a particular message from a group or individual chat using deleteMessage.
     */
    @realTime
    public async deleteMessage($data, $user) {
        let mes = await new chatModel().update({ "_id": $data.group_id, "conversations._id": $data._id }, { $set: { "conversations.$.isDropped": true } });
        this.emitToGroup($data.group_id, { type: "deleteMessage", data: $data._id });

        const grp: any = await new chatModel().find({ _id: $data.group_id }, "conversations");
        const lind: any = _.findLastIndex(grp[0].conversations, (val: any) => val.isDropped === false);
        mes = await common.lastMessage($data.group_id);
        const x: any = grp[0].conversations[lind];
        const messData = {
            text: mes,
            created_date_time: x.created_date_time,
            _id: $data.group_id
        };
        const socketIds = [];
        const arr: any = await getService.socketIoServicesInstance().groupBroadcast($data.group_id, $user._id);
        arr.forEach((element) => {
            socketIds.push.apply(socketIds, element.socket_id);
        });
        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "lastMessage", data: messData });
        this.broadcastToSockets(socketIds, { type: "lastMessage", data: messData });
    }

    /**
     * @function markfavorite
     * @param  $user User details of the requestor
     * @param  $data Message id that is to be marked favorite along with the conversation group ID
     * @description  Some messages may be important hence need to be remembered. A user may mark a message as favorite in a conversation which highlights it from regular messages.
     */
    @realTime
    public async markfavorite($user, $data) {
        const mes = await new chatModel().update({ "_id": $data.group_id, "conversations._id": $data.chat_id }, { $push: { "conversations.$.favorite": $user._id } });
        const markData = {
            _id: $data.group_id,
            chat_id: $data.chat_id,
            text: $data.text,
            created_date_time: new Date().toISOString()
        };
        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "markfavorite", data: markData }); // emitToSelf
    }

    /**
     * @function unreadChat
     * @param  $user User details of the requestor
     * @param  $data Conversation groups' array of a user
     * @description A user may have unread messages in a group conversation or individual chat. unreadChat gives the unread messages count for that particular group.
     */
    @realTime
    public async unreadChat($user, $data) {
        const grp: any = await new chatModel().findByPrimaryKey($data.group_id);
        let unreadCount;
        if (grp.conversations && grp.conversations.length !== 0) {
            unreadCount = grp.conversations.filter((val: any) => !val.isDropped && (val.type === chatType.text || val.type === chatType.doc) && val.created_by_user.toString() !== $user._id && val.readBy && !val.readBy.find((value: any) => value.user === $user._id)).length;
        }

        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "unreadChat", data: { count: unreadCount || 0, group_id: grp._id } });

    }

    /**
     * @function unmarkfavorite
     * @param  $user User details of the requestor
     * @param  $data Message id that is to be unmarked from favorite along with the conversation group ID
     * @description Unmarks a favorited message in a conversation
     */
    @realTime
    public async unmarkfavorite($user, $data) {
        const mes = await new chatModel().update({ "_id": $data.group_id, "conversations._id": $data.chat_id }, { $pull: { "conversations.$.favorite": $user._id } });
        const unmarkData = {
            _id: $data.group_id,
            chat_id: $data.chat_id,
            text: $data.text
        };
        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "unmarkfavorite", data: unmarkData });
    }

    /**
     * @function changeGroupSubject
     * @param  $user User details of the requestor
     * @param  $data Conversation group id along with the changed name of the group
     * @description Allows to change the name of the group. A user may edit the current name or change the group name entirely using changeGroupSubject.
     */
    @realTime
    public async changeGroupSubject($user, $data) {
        const group: any = await new chatModel().update({ _id: $data._id }, { $set: { subject: $data.subject } });
        const message = "<strong>" + $user.user_name + "</strong> changed subject to <strong>" + $data.subject + "</strong>";
        const grpdata = {
            _id: $data._id,
            type: chatType.message,
            text: message,
            created_date_time: new Date().toISOString()
        };
        const socketIds = [];
        const arr: any = await getService.socketIoServicesInstance().groupBroadcast($data._id, $user._id);

        arr.forEach((element) => {
            socketIds.push.apply(socketIds, element.socket_id);
        });
        this.broadcastToSockets(socketIds, { type: "changeGroupSubject", data: $data });
        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "changeGroupSubject", data: $data });
        this.emit({ type: "userMessagePrompt", data: grpdata });

    }

    /**
     * @function lastSeen
     * @param  $user User details of the requestor
     * @param  $data The message text and the group ID in which the message was sent
     * @description Gives the last message of the conversation
     */
    @realTime
    public async lastSeen($user, $data) {
        let message = $data.text;
        if (message && message.indexOf("<strong>") !== -1) {
            message = message.replace(/strong/g, "");
            message = message.replace(/[<]/g, "");
            message = message.replace(/[>]/g, "");
            message = message.replace(/[/]/g, "");
        }
        const lastSeenData = {
            _id: $data._id,
            text: message,
            created_date_time: new Date().toISOString()
        };
        const socketIds = [];
        const arr: any = await getService.socketIoServicesInstance().groupBroadcast($data._id, $user._id);
        arr.forEach((element) => {
            socketIds.push.apply(socketIds, element.socket_id);
        });
        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "lastSeen", data: lastSeenData });
        this.broadcastToSockets(socketIds, { type: "lastSeen", data: lastSeenData });
    }

    /**
     * @function getFavoriteMessages
     * @param  $user User details of the requestor
     * @param  $data ID of the conversation group whose messages are to be found
     * @description A user may mark messages as his favorites in a particular group. The api returns a list of all the messages that have been marked as favorites in a conversation.
     */
    @realTime
    public async getFavoriteMessages($user, $data) {
        const arr: any = await new chatModel().aggregate([
            { $match: { _id: chatModel.mongoose.Types.ObjectId($data._id) } },
            { $unwind: "$conversations" },
            { $match: { "conversations.favorite": chatModel.mongoose.Types.ObjectId($user._id), "conversations.isDropped": false } },
            { $project: { chat_id: "$conversations._id", text: "$conversations.text", created_date_time: "$conversations.created_date_time" } }
        ]);
        this.emit({ type: "getFavoriteMessages", data: arr });
    }

    /**
     * @function getLinks
     * @param  $user User details of the requestor
     * @param  $data ID of the conversation group in which the links are to be found
     * @description  A user may send certain important links as messages in a particular group. The api gives all the links present in a conversation.
     */
    @realTime
    public async getLinks($user, $data) {

        const group: any = await new chatModel().findByPrimaryKey($data.group_id, "_id");
        const obj: any = await new chatModel().aggregate([
            { $match: { _id: group._id } },
            { $unwind: "$conversations" },
            {
                $match: {
                    "conversations.text": { $regex: /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm, $options: "i" },
                    "conversations.isDropped": false
                }
            },
            { $project: { chat_id: "$conversations._id", text: "$conversations.text", created_date_time: "$conversations.created_date_time" } }
        ]);
        let arr = [];
        for (const object of obj) {
            const data = {
                txt: object.text.match(/(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm),
                created_date_time: object.created_date_time,
                chat_id: object.chat_id
            };
            arr.push(data);
        }
        arr = _.uniqBy(arr, "txt[0]");
        this.emit({ type: "getLinks", data: arr });
    }

    /**
     * @function groupDetails
     * @param  $user User details of the requestor
     * @param  $data ID of the conversation group whose details are to be found
     * @description Gives information about a group like the constituting users, name, whether a P2P chat or a group chat.
     */
    @realTime
    public async groupDetails($data) {
        const group: any = await new chatModel().findAndPopulate({ _id: $data._id }, [{ path: "users" }], "isP2PChat users subject created_by_user");
        this.emit({ type: "groupDetails", data: group[0] });
    }

    /**
     * @function
     * @param  $user User details of the requestor
     * @param  $data ID of the conversation group to be removed
     * @description  A user may have many conversations in his list. The api allows you to remove a conversation from our list.
     */
    @realTime
    public async removeUserRecent($data) {
        const conversData: any = await new chatModel().findByPrimaryKey({ _id: $data.conversation_id });
        await new chatModel().update({ _id: $data.conversation_id }, { $set: { users: null } });

        let removeData = { _id: $data.conversation_id, msg: "Conversation removed Successfully" };
        getService.socketIoServicesInstance().emitToSelf($data.user._id, { type: "removeUserRecent", data: removeData });

        if (conversData.isP2PChat) {
            removeData = { _id: $data.conversation_id, msg: "Conversation " + $data.user.user_name + " is removed by " + $data.user.user_name };
        } else {
            removeData = { _id: $data.conversation_id, msg: "Conversation is removed by " + $data.user.user_name };
        }
        conversData.users.forEach((val) => {
            if (val !== $data.user._id) {
                getService.socketIoServicesInstance().emitToSelf(val, { type: "removeUserRecent", data: removeData });
            }
        });
    }

    /**
     * @function
     * @param  $user User details of the requestor
     * @param  $data Current active group ID
     * @description  A user may be a part of many groups. The api gives the list of names of mutual groups with all other participant users of the group.
     */
    @realTime
    public async getCommonGroups($data) {
        const usersArray: any = await new chatModel().findOne({ _id: $data._id }, "_id users");
        const groups: any = await new chatModel().find({ isP2PChat: false, users: { $all: usersArray.users } }, "_id subject");
        this.emit({ type: "getCommonGroups", data: groups });
    }

    /**
     * @function commonGrp
     * @param  $user User details of the requestor
     * @param  $data ID of the other user with whom the mutual groups are to be found
     * @description A user may be a part of many groups. The api gives the mutual groups with a particular user.
     */
    @realTime
    public async commonGrp($user, $data) {
        const otherUser: any = await new userModel().findOne({ _id: $data.other_user });
        const groups: any = await new chatModel().find({ isP2PChat: true, users: { $all: [$user, otherUser] } }, "_id subject");
        this.emit({ type: "commonGrp", data: groups });
    }
}
