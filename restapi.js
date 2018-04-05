const http = require('http');
const querystring = require('querystring');
const Logging = require('@google-cloud/logging');
const Translate = require('@google-cloud/translate');
const rq = require('request-promise');
const port = 3000;
const projectId = 'my-project-1490450972690';

const logging = new Logging({
    projectId: projectId,
});
const translate = new Translate({
    projectId: 'plexiform-leaf-135623',
});
const log = logging.log('api-calls');
let fruits = [
    {id: 1, name: 'Portocale', price: 200, link: 'https://media.publika.md/md/image/201612/w720/11112_93558600.jpg'},
    {id: 2, name: 'Banane', price: 231, link: 'http://www.potecaverde.ro/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/f/q/fqycj72xuy_6.jpg'},
    {id: 3, name: 'Capsuni', price: 250, link: 'http://agrointel.ro/wp-content/uploads/2015/06/Soiul-de-capsuni-Honeoye.jpg'},
    {id: 4, name: 'Cirese', price: 100, link: 'https://www.antena3.ro/thumbs/big3/2018/02/09/cat-a-ajuns-ca-coste-un-kilogram-de-cirese-in-pietele-din-romania-507968.jpg'},
];

rq('https://us-central1-plexiform-leaf-135623.cloudfunctions.net/getData', (err, response) => {
    log.write(log.entry({}, { response: response.body })).then();
    fruits = JSON.parse(response.body);
});

log.write(log.entry({}, 'App has been init.')).then();

const requestHandler = (request, response) => {
    log.write(log.entry(request, { method: request.method, body: request.body })).then();
    switch(request.method) {
        case 'GET':
            getHandler(request, response);
            break;
        case 'POST':
            postHandler(request, response);
            break;
        case 'PUT':
            putHandler(request, response);
            break;
        case 'DELETE':
            deleteHandler(request, response);
    }
    log.write(log.entry(response, { status: response.statusCode, body: response.body })).then(() => {
        console.log('Logged');
    }).catch((err) => {
        console.log(err);
    });
};

function getHandler(request, response) {
    if (request.url === '/fruits') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(fruits));
    } else if (request.url.split('/')[1] === 'fruits' && request.url.split('/')[2]) {
        const fruit = fruits.find((f) => f.id == request.url.split('/')[2]);
        if (fruit) {
            log.write(log.entry({}, { requestedFruit: fruit })).then();
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(fruit));
        } else {
            response.statusCode = 404;
            response.end('Fruit not found!')
        }
    } else {
        response.statusCode = 404;
        response.end('Not found!');
    }
}

function postHandler(request, response) {
    if (request.url === '/fruits') {
        let jsonString = '';

        request.on('data', function (data) {
            jsonString += data;
        });

        request.on('end', function () {
            const newFruit = JSON.parse(jsonString);
            if (!newFruit.id || !newFruit.name || !newFruit.price) {
                response.statusCode = 400;
                response.end('Required fields are empty');
                return;
            }
            if (fruits.find(f => f.id === newFruit.id)) {
                response.statusCode = 400;
                response.end('Bad request. Fruit already exist.');
                return;
            }
            fruits.push(newFruit);
            response.statusCode = 201;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(fruits));
        });
    } else {
        response.statusCode = 404;
        response.end('Not found!');
    }
}

function deleteHandler(request, response) {
    if (request.url === '/fruits') {
        response.setHeader('Content-Type', 'application/json');
        fruits = [];
        response.end(JSON.stringify(fruits));
    } else if (request.url.split('/')[1] === 'fruits' && request.url.split('/')[2]) {
        const fruit = fruits.find((f) => f.id == request.url.split('/')[2]);
        if (fruit) {
            fruits = fruits.filter(f => f.id !== fruit.id);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(fruit));
        } else {
            response.statusCode = 404;
            response.end('Fruit not found!')
        }
    } else {
        response.statusCode = 404;
        response.end('Not found!');
    }
}

function putHandler(request, response) {
    if (request.url === '/fruits') {
        let jsonString = '';

        request.on('data', function (data) {
            jsonString += data;
        });

        request.on('end', function () {
            const newCollection = JSON.parse(jsonString);
            if (newCollection.length >= 0) {
                let count = 1;
                fruits = newCollection.map((fruit) => {
                    return {...fruit, id: count++}
                });
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(fruits));
            } else {
                response.statusCode = 401;
                response.end('Invalid body!');
            }
        });
    } else if (request.url.split('/')[1] === 'fruits' && request.url.split('/')[2]) {
        let jsonString = '';

        request.on('data', function (data) {
            jsonString += data;
        });

        request.on('end', function () {
            const fruitBody = JSON.parse(jsonString);
            let id = request.url.split('/')[2];
            if (id) {
                const fruit = fruits.find(f => f.id == id);
                if (!fruit) {
                    fruits.push({...fruitBody, id});
                    response.statusCode = 201;
                    response.setHeader('Content-Type', 'application/json');
                    response.end(JSON.stringify(fruits));
                } else {
                    fruit.name = fruitBody.name;
                    fruit.price = fruitBody.price;
                    response.statusCode = 201;
                    response.setHeader('Content-Type', 'application/json');
                    response.end(JSON.stringify(fruits));
                }
            } else {
                response.statusCode = 404;
                response.end('Id missing!');
            }
        });
    }
    else {
        response.statusCode = 404;
        response.end('Not found!');
    }
}

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }
    log.write(log.entry({}, `server is listening on ${port}`)).then();
    console.log(`server is listening on ${port}`)
});
