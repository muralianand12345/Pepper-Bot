# PEPPER BOT

### RUN COMMAND

- Install `cloudflared` https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

- config.yml
```yml
tunnel: tunnel-id
credentials-file: /Users/username/.cloudflared/tunnel-id.json

ingress:
  - hostname: pepper.domain.in
    service: http://localhost:3000
  - service: http_status:404
```

- Execute in terminal/cmd
```bash
# One Time Local only
cloudflared tunnel login
cloudflared tunnel create pepper-api
cloudflared tunnel route dns pepper-api peppermusic.domain.in


cloudflared tunnel --config ~/.cloudflared/config.yml run pepper-api
tsc
node .
```