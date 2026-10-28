FROM mcr.microsoft.com/azurelinux/base/nodejs:20
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8080
CMD ["node", "app.js"]
