import { realTimeMiddleware, realTimeMiddlewareBase, config, instance } from "t-webapi";
import userModel from "../schema/users";
import { onlineStatus } from "../constants/enums";
import common from "../services/commonService";
const packJSON = require("./../package.json");

/**
 * @class
 * @classdesc Performs validation checks prior to socket api calls
 * @extends realTimeMiddlewareBase
 */
export default class middleware extends realTimeMiddlewareBase {
    /**
     * @function authorizeUser
     * @param  $data Token for a particular user
     * @param  $user User details of the request sender
     * @description Authorizes a particular user
     */
    @realTimeMiddleware
    public async authorizeUser($data, $user) {

        const user = instance.createObjEncDecObj.decrypt($data.user_token);
        if (user && user.user_id === $user.user_id) {
            await this.next();
        } else {
            await this.fail("User is unauthorzied");
        }
    }

    /**
     * @function userActivity
     * @param  $user User details of the request sender
     * @param  $method Method name
     * @description Changes the status of the user according to his activity
     */
    @realTimeMiddleware
    public async userActivity($user, $method) {

        if ($user && $user._id && $method !== "changeStatus" && $method !== "ticker" && $method !== "unreadChat" && $method !== "addUserInTickerList") {
            const user1: any = await new userModel().findByPrimaryKey($user._id);
            const lastOnlineStatus = user1.online_status;
            user1.last_active = new Date().toISOString();
            user1.online_status = onlineStatus.online;

            if (lastOnlineStatus !== onlineStatus.online) {
                const socketIds: any = await common.addedUsersSocketIds($user);
                this.broadcastToSockets(socketIds, { type: "ticker", data: { created_date_time: new Date().toISOString(), user: user1 } });
            }
            new userModel().updateById(user1._id, user1);

        }
        await this.next();
    }
}
