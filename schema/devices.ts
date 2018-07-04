import { dbBase, schema } from "t-webapi";

/**
 * @class
 * @classdesc Schema for device details
 * @extends dbBase
 */
@schema
export default class device extends dbBase {

    private $schema = {
        user_id: { type: this.dataType.string },
        device: [{
            platform: { type: this.dataType.integer },
            device_id: { type: this.dataType.string },
            version: { type: this.dataType.string },
            os: { type: this.dataType.integer },
            is_active: { type: this.dataType.boolean, default: true }
        }]
    };

    constructor(a?) {
        super(a);
    }
}
