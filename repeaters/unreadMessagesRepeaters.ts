import { repeat, repeaterBase, instance } from "t-webapi";
import userModel from "../schema/users";
import chatModel from "../schema/chat";
import { onlineStatus } from "../constants/enums";
import commonService from "../services/commonService";

/**
 * @class
 * @classdesc Consists of methods dealing with repetitive functions used for unread messages
 * @extends repeaterBase
 */
export class unreadMessagesRepeaters extends repeaterBase {

    /**
     * @function doUnreadMessagesCount
     * @description Emits count of unread messages to a user for all the conversations
     */
    @repeat(10000)
    public async doUnreadMessagesCount() {
        const collection: any = await commonService.usersUnreadMessagesCount();
        let user: any;
        for (user of collection) {
            const socket_id = user.socket_id;
            delete user.socket_id;
            if (user.groups && user.groups.length) {
                instance.createRealTimeObj.broadcastToSockets(socket_id, { type: "unreadChat", data: user.groups });
            }
        }
    }

}
