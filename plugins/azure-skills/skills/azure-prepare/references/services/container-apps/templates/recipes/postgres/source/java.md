# PostgreSQL with Java

Packages: `org.postgresql:postgresql`, `com.azure:azure-identity`.

```java
TokenCredential credential = new DefaultAzureCredentialBuilder()
    .managedIdentityClientId(System.getenv("AZURE_CLIENT_ID"))
    .build();
AccessToken token = credential.getToken(new TokenRequestContext()
    .addScopes("https://ossrdbms-aad.database.windows.net/.default")).block();
Properties props = new Properties();
props.setProperty("user", System.getenv("PGUSER"));
props.setProperty("password", token.getToken());
props.setProperty("sslmode", "require");
Connection connection = DriverManager.getConnection(
    "jdbc:postgresql://" + System.getenv("PGHOST") + ":5432/"
        + System.getenv("PGDATABASE"), props);
```

Refresh the data source before token expiry.
