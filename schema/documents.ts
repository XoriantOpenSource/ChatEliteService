import { dbBase, schema } from "t-webapi";

/**
 * @class
 * @classdesc Schema for documents uploaded by a user
 * @extends dbBase
 */
@schema
export default class doc extends dbBase {

    private $schema = {
        originalFilename: this.dataType.string
    };

    constructor(a?) {
        super(a);

    }

}
