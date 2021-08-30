module.exports = {
    apps: [{
        name: 'ALLTALE_SERVER',
        script: 'app.js',
        env: {
            NODE_ENV: 'development',
        },
        env_production: {
            NODE_ENV: 'production',
            ALLTALE_HOST: 'alltale.i0x0i.ltd',
            ALLTALE_PORT: 29999,
            CORS_WHITELIST: ['http://alltale.i0x0i.ltd:29998']
        }
    }],

    deploy: {
        production: {
            key: '~/.ssh/id_rsa',
            user: 'root',
            host: '42.193.21.101',
            ref: 'origin/main',
            repo: 'git@github.com:Projekt-ALLTALE/ALLTALE_SERVER.git',
            path: '~/Project/ALLTALE_SERVER',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production --update-env',
            'pre-setup': ''
        }
    }
};
