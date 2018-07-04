
import { dbBase, schema } from "t-webapi";

/**
 * @class
 * @classdesc Schema for a conversation with a user
 * @extends dbBase
 */
@schema
export default class chat extends dbBase {
    private $schema = {

        subject: this.dataType.string,
        conversations: [{
            type: { type: this.dataType.string, default: "text" },
            doc_id: { type: this.dataType.objectId, ref: "doc" },
            text: this.dataType.string,
            created_date_time: { type: this.dataType.date, default: Date.now },
            created_by_user: { type: this.dataType.objectId, ref: "user" },
            isDropped: { type: this.dataType.boolean, default: false },
            favorite: [{ type: this.dataType.objectId, ref: "user" }],
            missed: { type: this.dataType.boolean, default: false },
            readBy: [{
                user: { type: this.dataType.objectId, ref: "user" },
                read_date: { type: this.dataType.date, default: Date.now }
            }],
            replyOf: {
                chat_name: this.dataType.string,
                chat_id: { type: this.dataType.objectId, ref: "user" },
                message: this.dataType.string
            }
        }],
        users: [{ type: this.dataType.objectId, ref: "user" }],
        created_by_user: { type: this.dataType.objectId, ref: "user" },
        created_date: { type: this.dataType.date, default: Date.now },
        last_access_date: { type: this.dataType.date, default: Date.now },
        isP2PChat: { type: this.dataType.boolean, default: false }
    };

    constructor(a?) {
        super(a);

    }

}
