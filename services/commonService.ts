import { _, logger } from "t-webapi";
import userModel from "../schema/users";
import chatModel from "../schema/chat";
import { onlineStatus } from "../constants/enums";

/**
 * @class
 * @classdesc Consists of services frequently used around different classes
 */
export default class commonService {

    /**
     * @function usersUnreadMessagesCount
     * @param onlineStatus Status of the user
     * @returns Returns an array of objects containg all groups with unread messages count
     * @description Counts the number of unread messages of a particular user for all conversations he has had
     */
    public static async usersUnreadMessagesCount() {
        const collection: any = [];
        const users: any = await new userModel().find({ online_status: onlineStatus.online }, "_id socket_id");
        let user: any;
        for (user of users) {
            const userCollection: any = {
                user_id: user._id,
                socket_id: user.socket_id,
                groups: []
            };
            const groups: any = await new chatModel().find({ users: user._id }, { _id: 1 });
            let group: any;
            for (group of groups) {
                const result: any = await new chatModel().aggregate([{ $match: { _id: group._id } },
                {
                    $project: {
                        _id: 1,
                        conversations: 1
                    }
                },
                { $unwind: "$conversations" },
                { $match: { "conversations.created_by_user": { $ne: user._id } } },
                { $match: { "conversations.type": "text" } },
                { $match: { "conversations.isDropped": false } },
                { $match: { "conversations.readBy.user": { $nin: [user._id] } } },
                {
                    $group:
                        {
                            _id: "$_id",
                            count: { $sum: 1 }
                        }
                }]);
                if (result && result.length) {
                    userCollection.groups.push(result[0]);
                } else {
                    const id = typeof group._id === "string" ? group._id : group.id;
                    userCollection.groups.push({
                        _id: id,
                        count: 0.0
                    });
                }
            }
            collection.push(userCollection);
        }

        return collection;
    }

    /**
     * @function addedUsersSocketIds
     * @param  $user User details
     * @returns An array of socket ids
     * @description Returns socketIds of all users added to a particular user's list
     */
    public static async addedUsersSocketIds($user) {
        const socketIds = [];
        const populateArr = [{ path: "invites" }];
        let users: any = await new userModel().findAndPopulate({ _id: $user._id }, populateArr, "invites");
        users = users[0].invites;
        let user: any;
        for (user of users) {
            socketIds.push.apply(socketIds, user.socket_id);
        }
        return socketIds;
    }

    /**
     * @function lastMessage
     * @param groupId ID of the conversation
     * @returns Returns a message string
     * @description Shows the last message sent in a particular conversation
     */
    @logger
    public static async lastMessage(groupId) {
        const grp: any = "";
        const con: any = await new chatModel().findOne({ _id: groupId }, "conversations");
        const ind: any = _.findLastIndex(con.conversations, (val: any) => val.isDropped === false);

        let lastMessage: string;
        if (ind > -1) {
            lastMessage = con.conversations[ind].text;
            if (lastMessage) {
                if (lastMessage.indexOf("<strong>") !== -1) {
                    lastMessage = lastMessage.replace(/strong/g, "");
                    lastMessage = lastMessage.replace(/[<]/g, "");
                    lastMessage = lastMessage.replace(/[>]/g, "");
                    lastMessage = lastMessage.replace(/[/]/g, "");
                }
            } else {
                lastMessage = "No message";
            }
        } else {
            lastMessage = "No message";
        }
        return lastMessage;
    }
}
