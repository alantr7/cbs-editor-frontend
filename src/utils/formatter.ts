type ComponentToStringFunction = (date: DateComponents) => string;

const placeholders: Record<string, ComponentToStringFunction> = {
    "HH": date => formatValue(date.hours, 2),
    "MM": date => formatValue(date.minutes, 2),
    "SS": date => formatValue(date.seconds, 2),
};

function formatValue(input: number, digits: number): string {
    let string_val = input.toString();
    while (string_val.length < digits) {
        string_val = "0" + string_val;
    }

    return string_val;
}

export function formatDate(date: Date, format: string) {
    const components = toComponents(date);
    let value = format;
    for (const placeholder of Object.entries(placeholders)) {
        value = value.replace(placeholder[0], placeholder[1](components));
    }

    return value;
}

function toComponents(date: Date): DateComponents {
    const time = date.getTime();
    let seconds = time / 1000;
    
    let minutes = seconds / 60;
    seconds = seconds % 60;

    let hours = minutes / 60;
    minutes = minutes % 60;

    let days = hours / 24;
    hours = hours % 24;

    return {
        days,
        hours: Math.floor(hours),
        minutes: Math.floor(minutes),
        seconds: Math.floor(seconds)
    }
}

export interface DateComponents {
    days: number,
    hours: number,
    minutes: number,
    seconds: number
}

export function formatOrdinal(num: number): string {
    const lastDigit = num % 10;
    switch (lastDigit) {
        case 1: return num + "st";
        case 2: return num + "nd";
        case 3: return num + "rd";
        default: return num + "th";
    }
}