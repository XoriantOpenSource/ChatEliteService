import { realTimeBase } from "t-webapi";
import userModel from "../schema/users";
import chatModel from "../schema/chat";

/**
 * @class
 * @classdesc Consists of methods related to sockets
 */
export default class socketService extends realTimeBase {

    /**
     * @function emitToSelf
     * @param userId UserID of the user
     * @param data Data that is to be transmitted
     * @description Emits to all socketIDs of a particular user
     */
    public async emitToSelf(userId: string, data: any) {
        const user: any = await new userModel().findByPrimaryKey(userId, "_id user_id user_name socket_id online_status invitedUsers");
        this.broadcastToSockets(user.socket_id, data);
    }

    /**
     * @function groupBroadcast
     * @param groupId ID of the conversation group
     * @param userId UserID of the user
     * @returns Returns an array of socket IDs
     * @description Emits to all socketIDs of a particular group except the requestor
     */
    public async groupBroadcast(groupId: string, userId: string) {
        const group: any = await new chatModel().findAndPopulate({ _id: groupId }, [{ path: "users" }], "users");
        const socketIds: any = [];
        for (const user of group[0].users) {
            if (user.socket_id.length > 0 && user._id != userId) {
                const obj = { _id: user._id, socket_id: user.socket_id, user_name: user.user_name };
                socketIds.push(obj);
            }
        }
        return socketIds;
    }
}
