
import { dbBase, schema } from "t-webapi";

/**
 * @class
 * @classdesc Schema for a user
 * @extends dbBase
 */
@schema
export default class user extends dbBase {

    private $schema = {
        user_id: { type: this.dataType.string, required: true },
        user_name: { type: this.dataType.string, required: true },
        password: this.dataType.string,
        profile_img: this.dataType.string,
        created_date: { type: this.dataType.date, default: Date.now },
        is_online: { type: this.dataType.boolean },
        socket_id: [this.dataType.string],
        current_socket: this.dataType.string,
        email_id: this.dataType.string,
        user_type: this.dataType.string,
        online_status: this.dataType.integer,
        last_online: { type: this.dataType.date, default: Date.now },
        last_active: { type: this.dataType.date, default: Date.now },
        grade: { type: this.dataType.string, required: true },
        isInviteUser: { type: this.dataType.boolean, default: false },
        invitedUsers: [{ type: this.dataType.objectId, ref: "user" }],
        invites: [{ type: this.dataType.objectId, ref: "user" }]
    };

    constructor(a?) {
        super(a);

    }

}
