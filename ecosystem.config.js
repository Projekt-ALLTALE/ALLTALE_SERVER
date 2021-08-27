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
        }
    }],

    deploy: {
        production: {
            key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDMc2AUcP3OriV0pXW52sgghCG+uJckMbTz+PPcjTNrxnnsSFYSxkVkL3TDWsqAr6Qg5kR00LhBCGeidUDTTi2IRl6XDMyxl/4PC1JftV3JX0SLed6RRP+OnYFfVcwFXCTokTblDVhM3MN2lZ2zN/n88Z7Guv0jW6IRXAaaWnrEduiL7Vd99/F4DAAYq3dPv5kz1SAHxBpkzULJG5w7rNPhXp9JVHesDk+DHMkTMeYq6b4l3tOAshcsr3QbdT+RX5oyaVD52pTeNsAbuMacM++H6NDToJfg9Hrahz3sMivECPYJ103JVLWMGwoWosW+mqOuNIGQUpTaw0d4gpfgogdi/0Cs6UzdmuSOpllVvWO4nTE68KXqfIEEr9r2HM7PB5IUEQCTop7jSjUy/UAlCy+Uac3bwZyir097GexiSTrfgVOXP4K/KQn0z/LP1Bpt1kE6HGsEIl+hgUaOaGzuTEsUrNi8PBc9SuG/X79g+7BL9u3IlEf2Z31otmPyBZBYSac= root@0x0-server',
            user: 'root',
            host: '42.193.21.101',
            ref: 'origin/main',
            repo: 'git@github.com:Projekt-ALLTALE/ALLTALE_SERVER.git',
            path: '~/Project/ALLTALE_SERVER',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
            'pre-setup': ''
        }
    }
};
