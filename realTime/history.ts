import { realTimeBase, _, realTime } from "t-webapi";
import userModel from "../schema/users";
import chatModel from "../schema/chat";
import common from "../services/commonService";
import { onlineStatus, chatType } from "../constants/enums";
import getService from "../services/getService";

/**
 * @class
 * @classdesc Consists of all socket apis relating to the Recent chats component
 * @extends realTimeBase
 */
export class historySocket extends realTimeBase {

    /**
     * @function history
     * @param  $user User details of requestor
     * @description A user may talk to different users or groups. The api gives the list of all the conversations the user has had till now.
     */
    @realTime
    public async history($user) {
        const chatMo = new chatModel();
        const populateArr = [{ path: "created_by_user" }, { path: "users" }];
        let hist: any = await chatMo.findAndPopulate({ users: $user._id }, populateArr, "_id subject created_by_user created_date users last_access_date isP2PChat");
        for (const g of hist) {
            g._doc.lastMessage = await common.lastMessage(g._id);
        }
        hist = _.sortBy(hist, (val: any) => -val.last_access_date);
        this.emit({ type: "history", data: hist });
    }

    /**
     * @function createsChatGroup
     * @param  $data Data consisting the group to be created
     * @param  $user User details of requestor
     * @description In order to begin chatting with a another user, a user must have certain room for it. The api creates a conversation group with user(s) to begin the conversation.
     */
    @realTime
    public async createsChatGroup($user, $data) {
        let message: any;
        let populateArr = [{ path: "users" }];
        let groups: any = await new chatModel().findAndPopulate({ users: $user._id }, populateArr, "_id users");
        let group: any = await new chatModel().find({
            isP2PChat: true,
            users: { $eq: $data.users }
        });
        if (!group.length) {
            if ($data.users.length === 2) {
                const user = $data.users[0];
                $data.users[0] = $data.users[1];
                $data.users[1] = user;
            }
            group = await new chatModel().find({
                isP2PChat: true,
                users: { $eq: $data.users }
            });
        }
        if (group.length) {
            let groupId: any;
            if (typeof (group[0]._id) === typeof ("")) {
                groupId = group[0]._id;
            } else if (typeof (group[0].id) === typeof ("")) {
                groupId = group[0].id;
            }
            this.emit({ type: "showExistingChat", data: { _id: groupId } });
        } else {
            $data.created_by_user = $user;
            if ($data.users.length === 2) {
                $data.isP2PChat = true;
                message = "<strong>started conversation</strong>";
            } else {
                message = "<strong>" + $user.user_name + "</strong> created group <strong>" + $data.subject + "</strong>";
            }
            const socketIds = [];
            group = await new chatModel().create($data);
            const arr: any = await getService.socketIoServicesInstance().groupBroadcast(group._id, $user._id);

            arr.forEach((element) => {
                socketIds.push.apply(socketIds, element.socket_id);
            });

            populateArr = [{ path: "created_by_user" }, { path: "users" }];
            groups = await new chatModel().findAndPopulate({ _id: group._id }, populateArr, "_id subject created_by_user created_date users last_access_date isP2PChat");
            group = groups[0];
            group._doc.createrUser = $user;
            group._doc.lastMessage = "no messages";
            const createGroupMessage = {
                _id: group._doc._id,
                type: chatType.message,
                text: message,
                created_date_time: new Date().toISOString()
            };
            getService.socketIoServicesInstance().emitToSelf($user._id, { type: "createsChatGroup", data: group });
            this.broadcastToSockets(socketIds, { type: "createsChatGroup", data: group });
            this.emit({ type: "userMessagePrompt", data: createGroupMessage });
        }
    }

    /**
     * @function allUsers
     * @param  $data User details
     * @param  $user User details of requestor
     * @description Returns a list of all users from DB except the requestor
     */
    @realTime
    public async allUsers($data, $user) {
        let users: any = await new userModel().findAll("user_id user_name is_online online_status last_online isInviteUser");
        users = users.filter((obj: any) => {
            const con = obj.id !== $user._id && !obj.isInviteUser;
            return con;
        });
        const sortedUsers = _.sortBy(users, (val: any) => val.online_status);
        this.emit({ type: "allUsers", data: sortedUsers });
    }

    /**
     * @function allUsersChatTransfer
     * @param  $data Details of the conversation group
     * @param  $user User details of requestor
     * @description A user may transfer chat to another user. Gives a list of users from the database to whom a chat conversation can be transferred to.
     */
    @realTime
    public async allUsersChatTransfer($user, $data) {
        const group: any = await new chatModel().findByPrimaryKey($data._id);
        let users: any = await new userModel().findAll("user_id user_name is_online online_status isInviteUser");
        if (group && group.users) {
            for (const user of group.users) {
                users = users.filter((obj: any) => {
                    return user.toString() !== obj._id.toString() && !obj.isInviteUser;
                });
            }
            this.emit({ type: "allUsersChatTransfer", data: users });
        }
    }

    /**
     * @function chatUser
     * @param  $user User details of requestor
     * @description Gives details of the current user who is active i.e self
     * @
     */
    @realTime
    public async chatUser($user) {
        if ($user.isInviteUser) {
            const user: any = await new userModel().findOne({ _id: $user._id });
            $user.invitedUsers = user.invitedUsers;
        }
        this.emit({ type: "chatUser", data: $user });
    }

    /**
     * @function showExistingChat
     * @param  $data ID of the conversation group that is to be opened
     * @description Whenever a user clicks on other user or group conversation, the api opens the existing conversation with a particular user or group.
     */
    @realTime
    public async showExistingChat($data) {
        this.emit({ type: "showExistingChat", data: $data._id });

    }

    /**
     * @function unreadMessages
     * @param  $user User details of requestor
     * @param  $data ID of the conversation group
     * @description A user may have unread message in a group. The api notifies the user that he has any unread messages.
     */
    @realTime
    public async unreadMessages($user, $data) {
        const group: any = await new chatModel().findByPrimaryKey($data);
        const socketIds = [];
        const arr: any = await getService.socketIoServicesInstance().groupBroadcast($data._id, $user._id);
        arr.forEach((element) => {
            socketIds.push.apply(socketIds, element.socket_id);
        });

        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "unreadMessages", data: { _id: group._id, user_name: $user.user_name } });
        this.broadcastToSockets(socketIds, { type: "unreadMessages", data: { _id: group._id, user_name: $user.user_name } });
    }

    /**
     * @function transferChat
     * @param  $user User details of the requestor
     * @param  $data Details of group whose chat is to be transferred
     * @description Transfers a conversation to a user
     */
    @realTime
    public async transferChat($user, $data) {
        let group: any = await new chatModel().findByPrimaryKey($data._id);
        const transferedUsersNames = [];
        for (const User of $data.users) {
            const userOfGroup: any = await new userModel().findByPrimaryKey(User);
            transferedUsersNames.push(userOfGroup.user_name);
        }
        for (const User of group.users) {
            if (User.toString() !== $user._id) {
                $data.users.push(User.toString());
            }
        }
        group.users = $data.users;
        group.subject = group.subject.indexOf("Transfered") === -1 ? "Transfered " + group.subject : group.subject;
        group.isP2PChat = false;
        const Obj: any = await new chatModel().updateById(group._id, group);

        const socketIds = [];
        for (const user of $data.users) {
            const userOfGroup: any = await new userModel().findByPrimaryKey(user);
            if (userOfGroup.socket_id) {
                socketIds.push.apply(socketIds, userOfGroup.socket_id);
            }
        }

        const populateArr = [{ path: "created_by_user" }, { path: "users" }];
        const groups = await new chatModel().findAndPopulate({ _id: group._id }, populateArr, "_id subject created_by_user created_date users last_access_date isP2PChat");
        group = groups[0];
        group._doc.lastMessage = await common.lastMessage(group._id);
        const message = "<strong>" + $user.user_name + "</strong> transfered chat to <strong>" + transferedUsersNames.join(",") + "</strong>";
        const messagedata = {
            _id: group._id,
            type: chatType.message,
            text: message,
            created_date_time: new Date().toISOString()
        };
        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "transferChatGroupChange", data: { group_id: group._id, users: transferedUsersNames.join(","), subject: $data.subject } });
        this.broadcastToSockets(socketIds, { type: "transferChat", data: group });
        this.emit({ type: "userMessagePrompt", data: messagedata });
    }

    /**
     * @function addUser
     * @param  $user User details of the requestor
     * @param  $data User details of the user to be added to the group
     * @description A user may add a particular user to an existing group. The api allows to add another user to an existing conversation group.
     */
    @realTime
    public async addUser($user, $data) {
        let group: any = await new chatModel().findByPrimaryKey($data._id);
        const preGrpUsers = [];
        const newGrpUsersSocketIds = [];
        const newGrpUsersNames = [];
        group.subject = group.subject.indexOf("Group") === -1 ? group.subject + " Group" : group.subject;
        for (const user of $data.users) {
            const userOfGroup: any = await new userModel().findByPrimaryKey(user);
            newGrpUsersNames.push(userOfGroup.user_name);
            if (userOfGroup.socket_id) {
                newGrpUsersSocketIds.push.apply(newGrpUsersSocketIds, userOfGroup.socket_id);
            }
        }
        for (const User of group.users) {
            $data.users.push(User.toString());
            preGrpUsers.push(User.toString());
        }
        group.users = $data.users;
        group.isP2PChat = false;
        const Obj: any = await new chatModel().updateById(group._id, group);

        const preGrpUsersSocketIds = [];
        for (const user of preGrpUsers) {
            const userOfGroup: any = await new userModel().findByPrimaryKey(user);
            if (userOfGroup.socket_id) {
                preGrpUsersSocketIds.push.apply(preGrpUsersSocketIds, userOfGroup.socket_id);
            }
        }

        const populateArr = [{ path: "created_by_user" }, { path: "users" }];
        const groups = await new chatModel().findAndPopulate({ _id: group._id }, populateArr, "_id subject created_by_user created_date users last_access_date isP2PChat");
        group = groups[0];
        group._doc.lastMessage = await common.lastMessage(group._id);
        const message = "<strong>" + $user.user_name + "</strong> added <strong>" + newGrpUsersNames.join(",") + "</strong>";
        const messagedata = {
            _id: group._id,
            type: chatType.message,
            text: message,
            created_date_time: new Date().toISOString()
        };
        this.broadcastToSockets(preGrpUsersSocketIds, { type: "addUserChange", data: group });
        this.broadcastToSockets(newGrpUsersSocketIds, { type: "addUsersIncurrentGrp", data: group });
        this.emit({ type: "userMessagePrompt", data: messagedata });

    }

    @realTime
    public async userMessage($user, $data) {
        setTimeout(() => {
            this.emitToGroup($data.data._id, { type: "userMessage", data: $data.data });
        }, 1000);
    }

    /**
     * @function leaveGroup
     * @param  $user User details of the requestor
     * @param  $data Conversation Id of the group to be left
     * @description A user may no more want to be a part of a group. The api allows a user to leave a particular group conversation.
     */
    @realTime
    public async leaveGroup($user, $data) {
        let group: any = await new chatModel().findByPrimaryKey($data._id);
        const index = group.users.indexOf($user._id);
        if (index > -1) {
            group.users.splice(index, 1);
        }
        const obj = await new chatModel().updateById(group._id, group);
        const socketIds = [];
        const arr: any = await getService.socketIoServicesInstance().groupBroadcast(group._id, $user._id);

        arr.forEach((element) => {
            socketIds.push.apply(socketIds, element.socket_id);
        });
        const message: any = "<strong>" + $user.user_name + "</strong> has left";
        const messagedata = {
            _id: group._id,
            type: chatType.message,
            text: message,
            created_date_time: new Date().toISOString()
        };
        const populateArr = [{ path: "created_by_user" }, { path: "users" }];
        const groups = await new chatModel().findAndPopulate({ _id: group._id }, populateArr, "_id subject created_by_user created_date users last_access_date isP2PChat");
        group = groups[0];
        group._doc.lastMessage = await common.lastMessage(group._id);
        const user: any = {
            isInviteUser: $user.isInviteUser,
            online_status: $user.online_status,
            user_id: $user.user_id,
            user_name: $user.user_name,
            _id: $user._id
        };
        group._doc.leftUser = user;
        this.broadcastToSockets(socketIds, { type: "leaveGroupChange", data: group });
        this.emit({ type: "userMessagePrompt", data: messagedata });
        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "leaveGroup", data: { _id: group._id } });
    }

    // Allows the creator of the group to remove a particular user from the group
    /**
     * @function removeUserFromGrp
     * @param  $user User details of the requestor
     * @param  $data Details of the user to be removed from the group
     * @description  Allows the creator of the group to remove a particular user from the group
     */
    @realTime
    public async removeUserFromGrp($user, $data) {
        const user: any = await new userModel().findOne({ _id: $data._id }, "user_name socket_id");
        const populateArr = [{ path: "users" }];
        const grp: any = await new chatModel().findAndPopulate({ _id: $data.group_id }, populateArr, "subject users");
        const mes = await new chatModel().update({ _id: $data.group_id }, { $pull: { users: $data._id } });
        const message: any = "<strong>" + $user.user_name + "</strong> Removed <strong>" + $data.user_name;
        const messagedata = {
            _id: $data.group_id,
            type: chatType.message,
            text: message,
            created_date_time: new Date().toISOString()
        };
        const socketIds = [];
        for (const u of grp[0].users) {
            if (u.socket_id.length) {
                socketIds.push.apply(socketIds, u.socket_id);
            }
        }
        this.emit({ type: "userMessagePrompt", data: messagedata });
        if (user.socket_id.length) {
            getService.socketIoServicesInstance().broadcastToSockets(user.socket_id, { type: "removeUserFromGrpChange", data: { _id: $data._id, group_id: $data.group_id, subject: grp[0].subject } });
        }
        getService.socketIoServicesInstance().emitToGroup($data.group_id, { type: "removeUserFromGrp", data: { _id: $data._id, user_name: $data.user_name, removedBy: $user._id } });
        getService.socketIoServicesInstance().broadcastToSockets(socketIds, { type: "removeUserChangeInRecent", data: { _id: $data._id, group_id: $data.group_id } });
    }
}
