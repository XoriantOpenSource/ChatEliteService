import { realTimeBase, instance, _, realTime } from "t-webapi";
import chatModel from "../schema/chat";
import common from "../services/commonService";
import userModel from "../schema/users";
import { onlineStatus } from "../constants/enums";
import mailService from "../services/mailingService";
import getService from "../services/getService";

/**
 * @class
 * @classdesc Consists of socket requests related to the users' component
 * @extends realTimeBase
 */
export class tickerSocket extends realTimeBase {

    /**
     * @function ticker
     * @param $data
     * @param $user User details of the sender
     * @description Whenever user goes out of focus or focusses in, other user(s) are informed about his status either online, away or offline.
     */
    @realTime
    public async ticker($data, $user) {
        const responseData = $data;
        responseData.user = $user;
        responseData.created_date_time = new Date().toISOString();
        responseData.user.online_status = onlineStatus.online;
        const socketIds = await common.addedUsersSocketIds($user);
        this.broadcastToSockets(socketIds, { type: "ticker", data: responseData });
    }

    /**
     * @function addUserInTickerList
     * @param $data Data of user to be added into the list
     * @param $user User details of the sender
     * @description  A user has contacts with different users. A list is maintained for each of the users that he has had a conversation with. The api allows a user to add a particular user to your list.
     */
    @realTime
    public async addUserInTickerList($user, $data) {
        const secondUser: any = await new userModel().findByPrimaryKey({ _id: $data.secondUser._id }, "_id user_id user_name is_online online_status last_online isInviteUser socket_id invites");
        const user: any = await new userModel().findByPrimaryKey($user._id);
        if (user.invites.indexOf(secondUser._id) === -1 && secondUser.invites.indexOf($user._id) === -1) {
            await new userModel().update({ _id: secondUser._id }, { $push: { invites: $user._id } });
            await new userModel().update({ user_id: $user.user_id }, { $push: { invites: secondUser._id } });
            getService.socketIoServicesInstance().emitToSelf($user._id, { type: "addUserInTickerList", data: secondUser });
            this.broadcastToSockets(secondUser.socket_id, { type: "addUserInTickerList", data: $user });
        }
    }

    /**
     * @function tickerAllUsers
     * @param $data User details
     * @param $user User details of the sender
     * @description  A user has contacts with different users. A list is maintained for each of the users that he has a contact with. The api gives all the users added into a particular user's list.
     */
    @realTime
    public async tickerAllUsers($user, $data) {
        if ($user.isInviteUser) {
            const populateArr = [{ path: "invitedUsers" }];
            const user: any = await new userModel().findAndPopulate({ _id: $user._id }, populateArr, "invitedUsers");
            const sortedUsers = _.sortBy(user[0].invitedUsers, (val: any) => val.online_status);
            this.emit({ type: "tickerAllUsers", data: sortedUsers });
        } else {
            const populateArr = { path: "invites" };
            const user: any = await new userModel().findAndPopulate({ _id: $user._id }, populateArr, "invites");
            const sortedUsers = _.sortBy(user[0].invites, (val: any) => val.online_status);
            this.emit({ type: "tickerAllUsers", data: sortedUsers });
        }
    }
}
