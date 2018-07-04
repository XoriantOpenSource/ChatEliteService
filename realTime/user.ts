import { realTimeBase, utils, realTime } from "t-webapi";
import userModel from "../schema/users";
import chatModel from "../schema/chat";
import common from "../services/commonService";
import { onlineStatus } from "../constants/enums";
import getService from "../services/getService";

/**
 * @class
 * @classdesc Consists of socket apis for handling user socket join, leave, status change
 * @extends realTimeBase
 */
export class userSocket extends realTimeBase {

    /**
     * @function userJoined
     * @param  $user details of the sender
     * @param  $socket Socket ID for a particular user on a device
     * @description Sockets are used for communicating with each other. An individual user login on a device corresponds to a socket. Socket(a user) joins a room for communication.
     */
    @realTime
    public async userJoined($user, $socket) {

        let user: any = await new userModel().findOne({ user_id: $user.user_id });
        if (!user) {
            // creating a user
            if (!$user.socket_id) {
                $user.socket_id = [];
            }
            $user.socket_id.push($socket);
            $user.online_status = onlineStatus.online;
            user = await new userModel().create($user);
        } else {
            user.grade = $user.grade;
            if (!user.socket_id) {
                user.socket_id = [];
            }
            user.socket_id.push($socket);
            user.online_status = onlineStatus.online;
            await new userModel().updateById(user._id, user);
        }
        getService.socketIoServicesInstance().emitToSelf(user._id, { type: "userJoined", data: user });
    }

    /**
     * @function drop
     * @param socketId  Socket ID for a particular user on a device
     * @description Sockets are used for communicating with each other. An individual user login on a device corresponds to a socket. A sockets leaves a room of a conversation using drop method.
     */
    @realTime
    public async drop(socketId) {
        await utils.timeoutAsync(5000);
        const tempUser: any = await new userModel().findOne({ socket_id: socketId });
        if (tempUser && socketId) {
            let lastOnline;
            if (tempUser.online_status === onlineStatus.online) {
                lastOnline = new Date().toISOString();
            } else {
                lastOnline = tempUser.last_online;
            }
            tempUser.online_status = onlineStatus.offline;
            const index = tempUser.socket_id.indexOf(socketId);
            if (index > -1) {
                tempUser.socket_id.splice(index, 1);
            }
            await new userModel().updateById(tempUser._id, { $set: { last_online: lastOnline, online_status: onlineStatus.offline, socket_id: tempUser.socket_id } });

            const socketIds = await common.addedUsersSocketIds(tempUser);
            this.broadcastToSockets(socketIds, { type: "ticker", data: { created_date_time: new Date().toISOString(), user: tempUser } });
        }
    }

    /**
     * @function changeStatus
     * @param  $user User details of the sender
     * @param  $data User details of the user to be removed from your list
     * @description Returns the current status of the user
     */
    @realTime
    public async changeStatus($user, $data) {
        $user.last_active = new Date().toISOString();
        $user.last_online = new Date().toISOString();
        $user.online_status = $data.onlineStatus;
        await new userModel().updateById($user._id, { $set: { online_status: $data.onlineStatus, last_active: new Date().toISOString(), last_online: new Date().toISOString() } });
        const socketIds: any = await common.addedUsersSocketIds($user);
        this.broadcastToSockets(socketIds, { type: "ticker", data: { created_date_time: new Date().toISOString(), user: $user, changeStatus: true } });
    }

    /**
     * @function removeUser
     * @param  $user User details of the sender
     * @param  $data User details of the user to be removed from your list
     * @description A user has contacts with different users. A list is maintained for each of the users that he has contact with. The api removes a particular user from a user's list.
     */
    @realTime
    public async removeUser($user, $data) {
        setTimeout(() => {
            new userModel().update({ _id: $user._id }, { $pull: { invites: $data.user_to_remove._id } });
            new userModel().update({ _id: $data.user_to_remove._id }, { $pull: { invites: $user._id } });
        }, 5000);
        getService.socketIoServicesInstance().emitToSelf($user._id, { type: "removeUser", data: { _id: $data.user_to_remove._id, user_name: $data.user_to_remove.user_name, removed_by: $user._id } });
        const anotherUser = { _id: $user._id, user_name: $user.user_name, removed_by: $user._id };
        getService.socketIoServicesInstance().emitToSelf($data.user_to_remove._id, { type: "removeUser", data: anotherUser });
    }
}
