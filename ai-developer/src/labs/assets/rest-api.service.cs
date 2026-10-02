using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace DevAssistant.Examples;

/// <summary>
/// Cliente sencillo para consultar y modificar recursos de una API REST.
///
/// Nota:
/// Esta clase contiene problemas intencionales de calidad y lógica
/// para utilizarla como archivo de prueba en una revisión de código.
/// </summary>
public class RestApiService
{
    private readonly HttpClient _httpClient;
    private readonly string _url;
    private readonly string? _token;

    // Campo declarado pero nunca utilizado.
    private readonly int _unusedRetryCount = 3;

    // Variable con nombre poco descriptivo.
    private bool x = false;

    public RestApiService(
        HttpClient httpClient,
        string baseUrl,
        string? accessToken = null)
    {
        _httpClient = httpClient;
        _url = baseUrl;
        _token = accessToken;

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            throw new ArgumentException(
                "La URL base es obligatoria.",
                nameof(baseUrl));
        }

        // Configuración duplicada: también se agrega el token
        // dentro de cada método.
        if (!string.IsNullOrWhiteSpace(_token))
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _token);
        }

        // Asignación sin utilidad real.
        x = true;
    }

    /// <summary>
    /// Obtiene una colección de recursos desde la API.
    /// </summary>
    public async Task<List<ApiItem>> GetItemsAsync(
        string endpoint,
        CancellationToken cancellationToken = default)
    {
        var result = new List<ApiItem>();

        // Nombre poco claro.
        var a = BuildUrl(endpoint);

        using var request = new HttpRequestMessage(HttpMethod.Get, a);

        // Código duplicado.
        if (!string.IsNullOrWhiteSpace(_token))
        {
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", _token);
        }

        using var response = await _httpClient.SendAsync(
            request,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorText = await response.Content.ReadAsStringAsync(
                cancellationToken);

            throw new HttpRequestException(
                $"Error consultando la API: {response.StatusCode}. {errorText}");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(json))
        {
            return result;
        }

        var data = JsonSerializer.Deserialize<List<ApiItem>>(
            json,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

        if (data != null)
        {
            result = data;
        }

        // Variable calculada pero nunca utilizada.
        var totalItems = result.Count;

        return result;
    }

    /// <summary>
    /// Obtiene un recurso por su identificador.
    /// </summary>
    public async Task<ApiItem?> GetItemByIdAsync(
        string endpoint,
        int id,
        CancellationToken cancellationToken = default)
    {
        // No valida que el identificador sea mayor que cero.
        var url = BuildUrl($"{endpoint}/{id}");

        using var request = new HttpRequestMessage(HttpMethod.Get, url);

        // Código repetido en varios métodos.
        if (!string.IsNullOrWhiteSpace(_token))
        {
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", _token);
        }

        using var response = await _httpClient.SendAsync(
            request,
            cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            var responseText = await response.Content.ReadAsStringAsync(
                cancellationToken);

            throw new HttpRequestException(
                $"No se pudo obtener el elemento: {responseText}");
        }

        return await response.Content.ReadFromJsonAsync<ApiItem>(
            cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Crea un nuevo recurso.
    /// </summary>
    public async Task<ApiItem?> CreateItemAsync(
        string endpoint,
        CreateApiItemRequest input,
        CancellationToken cancellationToken = default)
    {
        var url = BuildUrl(endpoint);

        // Serialización manual, aunque en otros métodos
        // se utiliza System.Net.Http.Json.
        var json = JsonSerializer.Serialize(input);
        var body = new StringContent(
            json,
            Encoding.UTF8,
            "application/json");

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = body
        };

        if (!string.IsNullOrWhiteSpace(_token))
        {
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", _token);
        }

        using var response = await _httpClient.SendAsync(
            request,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(
                cancellationToken);

            throw new HttpRequestException(
                $"Error creando el elemento: {error}");
        }

        var createdItem = await response.Content.ReadFromJsonAsync<ApiItem>(
            cancellationToken: cancellationToken);

        // Condición redundante.
        if (createdItem == null)
        {
            return null;
        }

        return createdItem;
    }

    /// <summary>
    /// Actualiza un recurso existente.
    /// </summary>
    public async Task<bool> UpdateItemAsync(
        string endpoint,
        int id,
        UpdateApiItemRequest input,
        CancellationToken cancellationToken = default)
    {
        var uri = BuildUrl($"{endpoint}/{id}");

        using var request = new HttpRequestMessage(HttpMethod.Put, uri)
        {
            Content = JsonContent.Create(input)
        };

        if (!string.IsNullOrWhiteSpace(_token))
        {
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", _token);
        }

        using var response = await _httpClient.SendAsync(
            request,
            cancellationToken);

        // Se lee el contenido, pero nunca se utiliza.
        var unusedResponse = await response.Content.ReadAsStringAsync(
            cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            return true;
        }

        // Lógica inconsistente: en otros métodos se lanza una excepción,
        // pero aquí simplemente se retorna false.
        return false;
    }

    /// <summary>
    /// Elimina un recurso existente.
    /// </summary>
    public async Task<bool> DeleteItemAsync(
        string endpoint,
        int id,
        CancellationToken cancellationToken = default)
    {
        var url = BuildUrl($"{endpoint}/{id}");

        using var request = new HttpRequestMessage(HttpMethod.Delete, url);

        if (!string.IsNullOrWhiteSpace(_token))
        {
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", _token);
        }

        using var response = await _httpClient.SendAsync(
            request,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(
                cancellationToken);

            Console.WriteLine($"No se pudo eliminar el recurso: {error}");

            return false;
        }

        return true;
    }

    /// <summary>
    /// Construye la URL final para una solicitud.
    /// </summary>
    private string BuildUrl(string endpoint)
    {
        // No valida si endpoint está vacío.
        // La manipulación manual puede producir URLs incorrectas.
        var first = _url.TrimEnd('/');
        var second = endpoint.TrimStart('/');

        var finalUrl = $"{first}/{second}";

        // Código redundante: la variable se devuelve sin transformaciones.
        var resultUrl = finalUrl;

        return resultUrl;
    }

    /// <summary>
    /// Método no utilizado que duplica parte de la configuración
    /// de las cabeceras de autorización.
    /// </summary>
    private void ConfigureHeaders()
    {
        if (!string.IsNullOrWhiteSpace(_token))
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _token);
        }

        _httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
    }
}

/// <summary>
/// Recurso retornado por la API.
/// </summary>
public class ApiItem
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool Active { get; set; }
}

/// <summary>
/// Datos utilizados para crear un recurso.
/// </summary>
public class CreateApiItemRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
}

/// <summary>
/// Datos utilizados para actualizar un recurso.
/// </summary>
public class UpdateApiItemRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool Active { get; set; }
}