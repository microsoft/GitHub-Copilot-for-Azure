# Rate Limiting Retry and Load Balancing Examples

Detailed code examples for implementing retry logic with exponential backoff and multi-region load balancing for handling 429 errors in Microsoft Foundry.

## Table of Contents

- [Python Retry Implementation](#python-retry-implementation)
- [C# Retry Implementation](#csharp-retry-implementation)
- [JavaScript/TypeScript Retry Implementation](#javascript-retry-implementation)
- [Multi-Region Load Balancing](#multi-region-load-balancing)
- [Request Optimization Patterns](#request-optimization-patterns)

## Python Retry Implementation

### Basic Retry with Exponential Backoff

```python
import time
import random
from azure.core.exceptions import HttpResponseError

def call_with_retry(func, max_retries=5, base_delay=1):
    """
    Call a function with exponential backoff retry logic for 429 errors.

    Args:
        func: Function to call
        max_retries: Maximum number of retry attempts (default: 5)
        base_delay: Initial delay in seconds (default: 1)

    Returns:
        Function result if successful

    Raises:
        HttpResponseError: If all retries exhausted
    """
    for attempt in range(max_retries):
        try:
            return func()
        except HttpResponseError as e:
            if e.status_code == 429:
                if attempt == max_retries - 1:
                    raise  # Last attempt, re-raise the error

                # Get Retry-After header if available
                retry_after = e.response.headers.get('Retry-After')
                if retry_after:
                    delay = int(retry_after)
                else:
                    # Exponential backoff: 1s, 2s, 4s, 8s, 16s
                    delay = base_delay * (2 ** attempt)
                    # Add jitter to prevent thundering herd
                    delay += random.uniform(0, 1)

                print(f"Rate limited. Retrying in {delay:.1f}s... (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            else:
                raise  # Not a 429 error, re-raise

# Usage example
from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential

client = ChatCompletionsClient(
    endpoint="https://your-resource.cognitiveservices.azure.com",
    credential=AzureKeyCredential("your-key")
)

response = call_with_retry(
    lambda: client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello!"}]
    )
)
```

### Context Manager for Automatic Retry

```python
from contextlib import contextmanager
import time
import random
from azure.core.exceptions import HttpResponseError

@contextmanager
def retry_on_rate_limit(max_retries=5, base_delay=1):
    """
    Context manager that automatically retries on 429 errors.

    Usage:
        with retry_on_rate_limit(max_retries=3):
            response = client.complete(...)
    """
    for attempt in range(max_retries):
        try:
            yield
            break  # Success, exit retry loop
        except HttpResponseError as e:
            if e.status_code == 429 and attempt < max_retries - 1:
                retry_after = e.response.headers.get('Retry-After')
                delay = int(retry_after) if retry_after else base_delay * (2 ** attempt)
                delay += random.uniform(0, 0.5)
                time.sleep(delay)
            else:
                raise
```

## C# Retry Implementation

### Using Polly for Resilient Retry

```csharp
using System;
using System.Net;
using System.Net.Http;
using Polly;
using Polly.Extensions.Http;
using Azure.AI.Inference;

public class RateLimitRetryHandler
{
    private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .OrResult(msg => msg.StatusCode == HttpStatusCode.TooManyRequests)
            .WaitAndRetryAsync(
                retryCount: 5,
                sleepDurationProvider: (retryAttempt, response, context) =>
                {
                    // Check for Retry-After header
                    if (response?.Result?.Headers?.RetryAfter?.Delta.HasValue == true)
                    {
                        return response.Result.Headers.RetryAfter.Delta.Value;
                    }

                    // Exponential backoff with jitter
                    var exponentialDelay = TimeSpan.FromSeconds(Math.Pow(2, retryAttempt));
                    var jitter = TimeSpan.FromMilliseconds(Random.Shared.Next(0, 1000));
                    return exponentialDelay + jitter;
                },
                onRetryAsync: async (outcome, timespan, retryAttempt, context) =>
                {
                    Console.WriteLine($"Rate limited. Retry {retryAttempt} after {timespan.TotalSeconds:F1}s");
                    await Task.CompletedTask;
                }
            );
    }

    public static HttpClient CreateResilientHttpClient()
    {
        var httpClient = new HttpClient();
        // Apply retry policy to HttpClient
        return httpClient;
    }
}

// Usage with Azure AI Inference client
var client = new ChatCompletionsClient(
    new Uri("https://your-resource.cognitiveservices.azure.com"),
    new AzureKeyCredential("your-key")
);

// The client will automatically retry on 429 errors
var response = await client.CompleteAsync(...);
```

### Manual Retry Implementation

```csharp
using System;
using System.Threading.Tasks;
using Azure;
using Azure.AI.Inference;

public static async Task<T> CallWithRetryAsync<T>(
    Func<Task<T>> operation,
    int maxRetries = 5,
    int baseDelaySeconds = 1)
{
    for (int attempt = 0; attempt < maxRetries; attempt++)
    {
        try
        {
            return await operation();
        }
        catch (RequestFailedException ex) when (ex.Status == 429)
        {
            if (attempt == maxRetries - 1)
                throw; // Last attempt, rethrow

            // Check for Retry-After header
            int delaySeconds;
            if (ex.GetRawResponse()?.Headers?.TryGetValue("Retry-After", out var retryAfter) == true
                && int.TryParse(retryAfter, out delaySeconds))
            {
                // Use server-provided delay
            }
            else
            {
                // Exponential backoff with jitter
                delaySeconds = baseDelaySeconds * (int)Math.Pow(2, attempt);
                delaySeconds += Random.Shared.Next(0, 1000) / 1000; // Add jitter
            }

            Console.WriteLine($"Rate limited. Retrying in {delaySeconds}s... (attempt {attempt + 1}/{maxRetries})");
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
        }
    }

    throw new InvalidOperationException("Should not reach here");
}

// Usage
var response = await CallWithRetryAsync(async () =>
    await client.CompleteAsync(new ChatCompletionsOptions
    {
        Messages = { new ChatMessage(ChatRole.User, "Hello!") }
    })
);
```

## JavaScript Retry Implementation

### Async/Await Retry Pattern

```javascript
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";

/**
 * Call a function with exponential backoff retry logic for 429 errors
 * @param {Function} fn - Async function to call
 * @param {number} maxRetries - Maximum retry attempts (default: 5)
 * @param {number} baseDelay - Initial delay in milliseconds (default: 1000)
 * @returns {Promise<any>} - Function result
 */
async function callWithRetry(fn, maxRetries = 5, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.statusCode === 429) {
        if (attempt === maxRetries - 1) {
          throw error; // Last attempt, rethrow
        }

        // Check for Retry-After header
        const retryAfter = error.response?.headers?.['retry-after'];
        let delay;

        if (retryAfter) {
          delay = parseInt(retryAfter) * 1000; // Convert to milliseconds
        } else {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          delay = baseDelay * Math.pow(2, attempt);
          // Add jitter to prevent thundering herd
          delay += Math.random() * 1000;
        }

        console.log(`Rate limited. Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Not a 429 error, rethrow
      }
    }
  }
}

// Usage example
const client = new OpenAIClient(
  "https://your-resource.cognitiveservices.azure.com",
  new AzureKeyCredential("your-key")
);

const response = await callWithRetry(async () =>
  await client.getChatCompletions("gpt-4o", [
    { role: "user", content: "Hello!" }
  ])
);
```

### TypeScript with Generics

```typescript
import { RestError } from "@azure/core-rest-pipeline";

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, delay: number) => void;
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 5, baseDelay = 1000, onRetry } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof RestError && error.statusCode === 429) {
        if (attempt === maxRetries - 1) {
          throw error;
        }

        // Get delay from Retry-After or use exponential backoff
        const retryAfter = error.response?.headers.get('retry-after');
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

        onRetry?.(attempt + 1, delay);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error("Max retries exceeded");
}
```

## Multi-Region Load Balancing

### Python Multi-Region Client with Fallback

```python
import random
from typing import List, Dict, Any
from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError

class MultiRegionClient:
    """
    Chat completions client with automatic failover across multiple regions.
    """

    def __init__(self, endpoints: List[Dict[str, str]]):
        """
        Args:
            endpoints: List of dicts with 'url' and 'key' for each region
                      Example: [
                          {"url": "https://eastus.cognitiveservices.azure.com", "key": "key1"},
                          {"url": "https://westeurope.cognitiveservices.azure.com", "key": "key2"}
                      ]
        """
        self.endpoints = endpoints
        self.clients = [
            ChatCompletionsClient(
                endpoint=ep["url"],
                credential=AzureKeyCredential(ep["key"])
            )
            for ep in endpoints
        ]

    def complete_with_fallback(self, **kwargs) -> Any:
        """
        Attempt completion across all regions until success.
        Shuffles regions for load distribution.
        """
        # Shuffle for load distribution
        indices = list(range(len(self.clients)))
        random.shuffle(indices)

        last_error = None
        for idx in indices:
            client = self.clients[idx]
            endpoint_name = self.endpoints[idx]["url"]

            try:
                # Try with retry on this region
                return call_with_retry(
                    lambda: client.chat.completions.create(**kwargs),
                    max_retries=3
                )
            except HttpResponseError as e:
                print(f"Failed on {endpoint_name}: {e}")
                last_error = e
                continue

        # All regions failed
        raise Exception(f"All regions failed. Last error: {last_error}")

# Usage
endpoints = [
    {"url": "https://foundry-eastus.cognitiveservices.azure.com", "key": "key1"},
    {"url": "https://foundry-westeurope.cognitiveservices.azure.com", "key": "key2"},
    {"url": "https://foundry-southeastasia.cognitiveservices.azure.com", "key": "key3"},
]

multi_client = MultiRegionClient(endpoints)

response = multi_client.complete_with_fallback(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Round-Robin Load Balancer

```python
import threading
from typing import List, Dict

class RoundRobinLoadBalancer:
    """
    Distributes requests evenly across multiple regions using round-robin.
    """

    def __init__(self, endpoints: List[Dict[str, str]]):
        self.endpoints = endpoints
        self.clients = [
            ChatCompletionsClient(
                endpoint=ep["url"],
                credential=AzureKeyCredential(ep["key"])
            )
            for ep in endpoints
        ]
        self.current_index = 0
        self.lock = threading.Lock()

    def get_next_client(self):
        """Get the next client in round-robin order."""
        with self.lock:
            client = self.clients[self.current_index]
            endpoint = self.endpoints[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.clients)
            return client, endpoint

    def complete(self, **kwargs):
        """Send request to next region in rotation."""
        client, endpoint = self.get_next_client()

        try:
            return call_with_retry(
                lambda: client.chat.completions.create(**kwargs)
            )
        except Exception as e:
            print(f"Request failed on {endpoint['url']}: {e}")
            # Optionally implement fallback to other regions here
            raise

# Usage
load_balancer = RoundRobinLoadBalancer(endpoints)

# Requests are automatically distributed across regions
response1 = load_balancer.complete(model="gpt-4o", messages=[...])  # Region 1
response2 = load_balancer.complete(model="gpt-4o", messages=[...])  # Region 2
response3 = load_balancer.complete(model="gpt-4o", messages=[...])  # Region 3
```

## Request Optimization Patterns

### Token Usage Optimization

```python
def optimize_prompt(text: str, max_tokens: int = 4000) -> str:
    """
    Truncate input to stay within token limits.
    Approximation: 1 token ≈ 4 characters
    """
    max_chars = max_tokens * 4
    if len(text) > max_chars:
        return text[:max_chars] + "..."
    return text

# Usage
user_input = "very long text..." * 1000
optimized_input = optimize_prompt(user_input, max_tokens=2000)

response = call_with_retry(
    lambda: client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": optimized_input}]
    )
)
```

### Batch Request Processing

```python
import time
from typing import List, Any, Callable

def batch_requests(
    requests: List[Any],
    process_fn: Callable,
    batch_size: int = 10,
    pause_between_batches: float = 1.0
):
    """
    Process requests in batches to avoid overwhelming the API.

    Args:
        requests: List of requests to process
        process_fn: Function to process each request
        batch_size: Number of requests per batch
        pause_between_batches: Delay in seconds between batches
    """
    results = []

    for i in range(0, len(requests), batch_size):
        batch = requests[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1} ({len(batch)} requests)...")

        # Process batch
        batch_results = [
            call_with_retry(lambda req=req: process_fn(req))
            for req in batch
        ]
        results.extend(batch_results)

        # Pause between batches (except after last batch)
        if i + batch_size < len(requests):
            time.sleep(pause_between_batches)

    return results

# Usage
def process_text(text: str):
    return client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": text}]
    )

texts = ["text1", "text2", "text3", ...] # 100 texts
results = batch_requests(texts, process_text, batch_size=10, pause_between_batches=2.0)
```

### Rate Limiter Class

```python
import time
import threading

class RateLimiter:
    """
    Token bucket rate limiter to prevent exceeding rate limits.
    """

    def __init__(self, rate: int, per: float = 60.0):
        """
        Args:
            rate: Number of requests allowed
            per: Time period in seconds (default: 60 = per minute)
        """
        self.rate = rate
        self.per = per
        self.allowance = rate
        self.last_check = time.time()
        self.lock = threading.Lock()

    def wait_if_needed(self):
        """Wait if rate limit would be exceeded."""
        with self.lock:
            current = time.time()
            time_passed = current - self.last_check
            self.last_check = current

            # Replenish tokens based on time passed
            self.allowance += time_passed * (self.rate / self.per)

            if self.allowance > self.rate:
                self.allowance = self.rate  # Cap at max rate

            if self.allowance < 1.0:
                # Need to wait
                sleep_time = (1.0 - self.allowance) * (self.per / self.rate)
                print(f"Rate limit: waiting {sleep_time:.2f}s...")
                time.sleep(sleep_time)
                self.allowance = 0.0
            else:
                self.allowance -= 1.0

# Usage: Limit to 60 requests per minute
rate_limiter = RateLimiter(rate=60, per=60.0)

for text in texts:
    rate_limiter.wait_if_needed()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": text}]
    )
```

## Testing Retry Logic

### Unit Test Example

```python
import pytest
from unittest.mock import Mock, patch
from azure.core.exceptions import HttpResponseError

def test_retry_on_429():
    """Test that retry logic works correctly on 429 errors."""
    mock_func = Mock()

    # Simulate 2 failures, then success
    mock_func.side_effect = [
        HttpResponseError(message="Rate limited", response=Mock(status_code=429, headers={})),
        HttpResponseError(message="Rate limited", response=Mock(status_code=429, headers={})),
        "Success"
    ]

    result = call_with_retry(mock_func, max_retries=5, base_delay=0.1)

    assert result == "Success"
    assert mock_func.call_count == 3

def test_retry_respects_max_retries():
    """Test that retry stops after max_retries."""
    mock_func = Mock()
    mock_func.side_effect = HttpResponseError(
        message="Rate limited",
        response=Mock(status_code=429, headers={})
    )

    with pytest.raises(HttpResponseError):
        call_with_retry(mock_func, max_retries=3, base_delay=0.1)

    assert mock_func.call_count == 3

def test_retry_uses_retry_after_header():
    """Test that Retry-After header is respected."""
    mock_func = Mock()

    response = Mock(status_code=429, headers={'Retry-After': '5'})
    mock_func.side_effect = [
        HttpResponseError(message="Rate limited", response=response),
        "Success"
    ]

    with patch('time.sleep') as mock_sleep:
        result = call_with_retry(mock_func, max_retries=3)

        # Should have used Retry-After value
        mock_sleep.assert_called_once()
        assert mock_sleep.call_args[0][0] == 5
```
