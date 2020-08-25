
//*********** ERROR HANDLERS ***********/
module.exports = (fastify) => 
{
    fastify.setNotFoundHandler( (request, reply) => 
    {
        reply.code(404).type('text/html').send('<h1>Not Found<\h1>')
    })
}

