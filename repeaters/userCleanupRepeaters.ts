import { repeat, repeaterBase, instance } from "t-webapi";
import userModel from "../schema/users";
import { onlineStatus } from "../constants/enums";
import commonService from "../services/commonService";

/**
 * @class
 * @classdesc
 * @extends repeaterBase
 */
export class userCleanupRepeaters extends repeaterBase {
    /**
     * @function doSocketCleanUp
     * @description A socket may disconnect abruptly however, still persists in the database due to some reasons. doSocketCleanUp cleans the unused socket entries from the database periodically.
     */
    @repeat(300000)
    public async doSocketCleanUp() {

        if (instance.getSocketInst.IO) {
            const users: any = await new userModel().find({});

            const Users = [];
            Users.push.apply(Users, users);

            for (const user of Users) {

                const socketIds: any = instance.getSocketInst.IO.sockets.server.eio.clients;
                if (user.socket_id) {
                    for (const socketId of user.socket_id) {

                        if (Object.keys(socketIds).indexOf(socketId) === -1) {
                            const index = user.socket_id.indexOf(socketId);
                            user.socket_id.splice(index, 1);

                        }
                    }
                    await new userModel().update({ _id: user._id }, { $set: { socket_id: user.socket_id } });
                }
            }
        }

        await this.continue();
    }

    /**
     * @function doUserCleanup
     * @description  If a user is inactive for about a day, he is logged out.
     */
    @repeat(120000)
    public async doUserCleanup() {
        const users = await new userModel().find({});
        const Users = [];

        Users.push.apply(Users, users);
        const currentDateTime = new Date(new Date().toISOString()).getTime();
        for (const user of Users) {
            if (user.last_active) {
                const userDateTime = new Date(user.last_active).getTime();
                if ((currentDateTime - 12 * 60 * 60 * 1000) >= userDateTime && user.online_status !== onlineStatus.offline) {
                    user.online_status = onlineStatus.offline;
                    await new userModel().updateById(user._id, user);
                    instance.createRealTimeObj.broadcastToSockets([user.socket_id], { type: "logoutUser" });
                    this.broadCastConversation(user);
                } else if ((currentDateTime - 5 * 60 * 1000) >= userDateTime && user.online_status === onlineStatus.online) {
                    user.online_status = onlineStatus.away;
                    await new userModel().updateById(user._id, user);
                    this.broadCastConversation(user);
                }
            }
        }

        await this.continue();
    }

    /**
     * @function broadCastConversation
     * @param  $user User details of the request sender
     * @description Broadcasts to the entire channel
     */
    private async broadCastConversation($user) {
        instance.createRealTimeObj.broadcastAll({ type: "ticker", data: { created_date_time: new Date().toISOString(), user: $user } });
    }
}
