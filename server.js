module.exports = (fastify,CONSTS) => 
{
    // Start the server
    const start = async () => 
    {
        try 
        {
            await fastify.listen(CONSTS.WEB_SERVICE_PORT, CONSTS.WEB_SERVICE_ADDR)
            fastify.log.info(`server listening on ${fastify.server.address().port}`)
        } 
        catch (err) 
        {
            fastify.log.error(err)
            process.exit(1)
        }
    }
    start();
}