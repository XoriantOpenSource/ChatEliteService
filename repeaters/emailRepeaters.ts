import { repeat, repeaterBase } from "t-webapi";
import userModel from "../schema/users";
import chatModel from "../schema/chat";
import { onlineStatus } from "../constants/enums";
import commonService from "../services/commonService";
import mailingService from "../services/mailingService";

/**
 * @class
 * @classdesc Consists of functions that will be periodically used for mailing services
 * @extends repeaterBase
 */
export default class emailRepeaters extends repeaterBase {

    /**
     * @function doP2PChatCleanup
     * @description Refreshes an array consisting users periodically
     */
    @repeat(2 * 60000)
    public async doP2PChatCleanup() {
        mailingService.p2pChatsUsers = [];
    }

    /**
     * @function doGroupChatCleanup
     * @description Cleans the group information array used in mailing service periodically
     */
    @repeat(20 * 60000)
    public async doGroupChatCleanup() {
        mailingService.groupChatsUsers = [];
    }
}
