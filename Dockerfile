# Build en una etapa aparte para que la imagen final no cargue con el compilador
# ni con las dependencias de desarrollo.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Nunca como root: si alguien logra ejecutar codigo dentro del contenedor, que
# no lo haga con privilegios. Es de las preguntas que hace una revision de
# seguridad y la respuesta correcta cuesta tres lineas.
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./

USER app
EXPOSE 3000

# El mismo endpoint que usa kamal-proxy para decidir si mandar trafico.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/main.js"]
