require('dotenv').config();

const basicAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).send('Access denied. No credentials provided.');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    const user = process.env.BASIC_AUTH_USER;
    const pass = process.env.BASIC_AUTH_PASS;

    if (username === user && password === pass) {
        next();
    } else {
        res.status(401).send('Access denied. Incorrect credentials.');
    }
};
module.exports = basicAuth