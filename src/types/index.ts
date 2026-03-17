const ROLES = {
    ADMIN: process.env.ROLE_ADMIN || 'ADMIN',
    OPERATOR: process.env.ROLE_OPERATOR || 'OPERATOR',
    INVESTOR: process.env.ROLE_INVESTOR || 'INVESTOR',
    ASSOCIATE: process.env.ROLE_ASSOCIATE || 'ASSOCIATE',
};

export { ROLES };