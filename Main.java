import com.fastcgi.FCGIInterface;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class Main {
    private static final Set<Integer> XS = Set.of(-4, -3, -2, -1, 0, 1, 2, 3, 4);
    private static final Set<Integer> RS = Set.of(1, 2, 3, 4, 5);
    private static final BigDecimal Y_MIN = new BigDecimal("-5");
    private static final BigDecimal Y_MAX = new BigDecimal("5");

    private static final List<String> results = new ArrayList<>();

    public static void main(String[] args) {
        FCGIInterface fcgi = new FCGIInterface();
        while (fcgi.FCGIaccept() >= 0) {
            long start = System.nanoTime();
            try {
                handle(start);
            } catch (Exception e) {
                try { send(500, "Internal Server Error", error("Server error")); } catch (IOException ex) {}
            }
        }
    }

    private static void handle(long start) throws IOException {
        String method = FCGIInterface.request.params.getProperty("REQUEST_METHOD");

        if ("GET".equals(method)) {
            send(200, "OK", answer(start));
            return;
        }
        if (!"POST".equals(method)) {
            send(405, "Method Not Allowed", error("Only GET and POST are allowed"));
            return;
        }

        Map<String, String> p;
        try {
            p = parse(readBody());
        } catch (IllegalArgumentException e) {
            send(400, "Bad Request", error("Malformed request body"));
            return;
        }

        String problem = validate(p);
        if (problem != null) {
            send(400, "Bad Request", error(problem));
            return;
        }

        int x = Integer.parseInt(p.get("x"));
        BigDecimal y = new BigDecimal(p.get("y"));
        int r = Integer.parseInt(p.get("r"));
        boolean hit = isHit(BigDecimal.valueOf(x), y, BigDecimal.valueOf(r));

        long execNs = System.nanoTime() - start;

        results.add("{\"x\":" + x + ",\"y\":\"" + y.toPlainString() + "\",\"r\":" + r
                + ",\"hit\":" + hit + ",\"time\":" + System.currentTimeMillis()
                + ",\"execNs\":" + execNs + "}");
        send(200, "OK", answer(start));
    }

    static boolean isHit(BigDecimal x, BigDecimal y, BigDecimal r) {
        int sx = x.signum();
        int sy = y.signum();
        if (sx >= 0 && sy >= 0) {
            return x.add(y).compareTo(r) <= 0;
        }
        if (sx <= 0 && sy >= 0) {
            return x.multiply(x).add(y.multiply(y)).compareTo(r.multiply(r)) <= 0;
        }
        if (sx >= 0 && sy <= 0) {
            return x.multiply(BigDecimal.valueOf(2)).compareTo(r) <= 0 && y.compareTo(r.negate()) >= 0;
        }
        return false;
    }

    static String validate(Map<String, String> p) {
        String x = p.get("x");
        String y = p.get("y");
        String r = p.get("r");
        if (x == null || y == null || r == null)
            return "X, Y and R are required";

        if (!x.matches("-?\\d{1,2}") || !XS.contains(Integer.parseInt(x)))
            return "X must be one of -4..4";
        if (!r.matches("\\d") || !RS.contains(Integer.parseInt(r)))
            return "R must be one of 1..5";

        if (!y.matches("[+-]?\\d{1,20}(\\.\\d{1,20})?"))
            return "Y must be a number";
        BigDecimal yv = new BigDecimal(y);
        if (yv.compareTo(Y_MIN) <= 0 || yv.compareTo(Y_MAX) >= 0)
            return "Y must be between -5 and 5 (exclusive)";

        return null;
    }

    private static String readBody() throws IOException {
        String len = FCGIInterface.request.params.getProperty("CONTENT_LENGTH");
        int n;
        try {
            n = (len == null || len.isEmpty()) ? 0 : Integer.parseInt(len);
        } catch (NumberFormatException e) {
            n = 0;
        }
        if (n > 1024)
            n = 1024;
        byte[] buf = new byte[n];
        InputStream in = System.in;
        int read = 0;
        while (read < n) {
            int k = in.read(buf, read, n - read);
            if (k < 0)
                break;
            read += k;
        }
        return new String(buf, 0, read, StandardCharsets.UTF_8);
    }

    static Map<String, String> parse(String body) {
        Map<String, String> map = new HashMap<>();
        for (String pair : body.split("&")) {
            int eq = pair.indexOf('=');
            if (eq <= 0)
                continue;
            String key = URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8);
            String v = URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8).trim();
            if (key.equals("y")) {
                v = v.replace(',', '.');
            }
            map.putIfAbsent(key, v);
        }
        return map;
    }

    private static String answer(long start) {
        long execNs = System.nanoTime() - start;
        return "{\"now\":" + System.currentTimeMillis()
                + ",\"execNs\":" + execNs
                + ",\"results\":[" + String.join(",", results) + "]}";
    }

    private static String error(String message) {
        return "{\"error\":\"" + message + "\"}";
    }

    private static void send(int code, String status, String json) throws IOException {
        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        String head = "HTTP/1.1 " + code + " " + status + "\r\n"
                + "Content-Type: application/json; charset=utf-8\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "\r\n";
        System.out.write(head.getBytes(StandardCharsets.UTF_8));
        System.out.write(body);
        System.out.flush();
    }
}
