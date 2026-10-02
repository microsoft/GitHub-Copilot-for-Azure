ARG DOTNET_SDK_VERSION
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_SDK_VERSION}-alpine3.23

RUN apk add --no-cache clang build-base musl-dev binutils zlib-dev bash unzip
